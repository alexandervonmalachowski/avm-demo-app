# Infrastructure

Setting up infrastructure for the project.

Should use the [azure best practice naming convention](https://docs.microsoft.com/en-us/azure/cloud-adoption-framework/ready/azure-best-practices/resource-naming)

## Azure CLI

```sh
# Login
az login

# Verify account
az account show

# Set default subscription, if not already correct
az account set --subscription cbrs-hometestppe-nonprd

# Logout
az account clear
```

If there are any issues with installations or versions, it's possible to run a container with azure cli in it.
That way we can guarantee a functioning azure cli installation.

```sh
# Start a container with azure cli in it
docker run --rm -it -v "$(git rev-parse --show-toplevel)/HOME_TEST_API_V1":/home -w /home mcr.microsoft.com/azure-cli:2.24.0

# Inside the container, you need to login
az login
az account set -s cbrs-hometestppe-nonprd
```

## Azure Resource Manager - IaC

The backend uses ARM templates and azure cli for setup. And it uses the azure cli, docker and ARM templates to deploy new versions to an environment.

There are three different ARM templates used, separated by change frequency.

- Shared resources, should about once per subscription setup.
- Environment resources, should run about once per deployment environment (dev, qa, prod).
- Deployment configuration, should run for each new version to an environment.

### Environment names and resource group creation

Name and create the resource groups are created via the cli, not with templates. Yet.

```sh
export group_shared='rg-shared-nonprd'
export env='unstable'
export group_env="rg-hometest-api-${env:?}"
az group create --location 'westeurope' --name ${group_shared:?}
az group create --location 'westeurope' --name ${group_env:?}
# az group delete --name ${group_env:?} -y &
```

### ARM validation and expectations

```sh
# Validation
az deployment group validate \
    --resource-group ${group_shared:?} \
    --template-file infrastructure/template-be-shared.json \
    --parameters @infrastructure/parameters.json

az deployment group validate \
    --resource-group ${group_env:?} \
    --template-file infrastructure/be-template-environment.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=${env:?}"

az deployment group validate \
    --resource-group ${group_env:?} \
    --template-file infrastructure/be-template-deploy.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=${env:?}"

# What-If
az deployment group what-if \
    --resource-group ${group_shared:?} \
    --template-file infrastructure/template-be-shared.json \
    --parameters @infrastructure/parameters.json

az deployment group what-if \
    --resource-group ${group_env:?} \
    --template-file infrastructure/be-template-environment.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=${env:?}"

az deployment group what-if \
    --resource-group ${group_env:?} \
    --template-file infrastructure/be-template-deploy.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=${env:?}"
```

### Shared resource creation

```sh
# Create resources from the template
# WARNING:
#  You are about to reset all the keyvault access policies!
#  All environments will need to be re-deployed to re-gain access.
az deployment group create \
    --resource-group ${group_shared:?} \
    --template-file infrastructure/template-be-shared.json \
    --parameters @infrastructure/parameters.json

# Show deployments
az deployment group list --resource-group ${group_shared:?} -o table
```

```sh
# Set secrets in the shared environment

api_cte=$(
  jq -n '{
    "base_path": "TBD",
    "api_key": "TBD",
    "app_key": "TBDc"
  }'
)
client_nonprod=$(
  jq -n '{
    "token_url": "TBD",
    "client_id": "TBD",
    "client_secret": "TBD",
    "scope": "TBD",
  }'
)

# WARNING:
#  You are about to override the existing secrets!
#  Make sure to update the parameters, or skip this step if they already exist.
az deployment group create \
    --resource-group ${group_shared:?} \
    --template-file infrastructure/template-be-shared-secrets.json \
    --parameters keyVaultName="kv-avmdemoapp-dev" \
    --parameters environmentName="dev" \
    --parameters apiSecrets="$(echo "[$api_cte,  $client_nonprod]" | jq '.[0] + .[1]')"
```

### Environment resource creation

```sh
# Yes, we regenerate and update the password for each environment deployment
username='hometest'
password="$(cat /dev/random | head -c 48 | base64)"

# Create environment
az deployment group create \
    --resource-group ${group_env:?} \
    --template-file infrastructure/be-template-environment.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=${env:?}" \
    --parameters "keyVaultResourceGroup=${group_shared:?}" \
    --parameters "databaseAdministratorLogin=${username:?}" \
    --parameters "databaseAdministratorLoginPassword=${password:?}"

# Show deployments
az deployment group list --resource-group ${group_env:?} -o table

# Delete environment
# az deployment group delete \
#     --resource-group $group_env \
#     --name be-template-environment
```

#### Optional post deployment

```sh
# Check the logs, after deployment
az webapp log tail -g ${group_env:?} -n "app-hometest-api-${env:?}"

# Try out the api
while : ; do curl -s "https://app-hometest-api-${env:?}.azurewebsites.net/v1/product/ART-00073336" | jq . ; sleep 10 ; done
```

## Database

By default the database which is created with IaC blocks all external incoming connections.

```sh
# First of all, the postgres servers can be managed with the azure cli and the postgres subcommand
az postgres server -h
```

If you want to connect to any of the databases in Azure you need to open up the firewall.

```sh
# List servers
az postgres server list

# The server environment to open up and the ip to allow
env='unstable'
myip=$(curl -s http://ifconfig.me)
echo "${env:?} - ${myip:?}"

# List the current firewall rules for the "env" server
# This _should_ be empty if no one else is using the database right now.
az postgres server firewall-rule list -g "rg-hometest-api-${env:?}" --server-name "psql-hometest-api-${env:?}" -o table

# Create a firewall rule to allow yourself
az postgres server firewall-rule create \
    --name temporarily-allow-access \
    --resource-group "rg-hometest-api-${env:?}" \
    --server-name "psql-hometest-api-${env:?}" \
    --start-ip-address "${myip:?}" \
    --end-ip-address "${myip:?}"

# Cleanup, this _should_ be run when you are done using the database
az postgres server firewall-rule delete \
    --name temporarily-allow-access \
    --resource-group "rg-hometest-api-${env:?}" \
    --server-name "psql-hometest-api-${env:?}"


# Secret connection string
az keyvault secret list --vault-name kv-avmdemoapp-dev -o table
connection_string=$(
    az keyvault secret show \
       --vault-name kv-avmdemoapp-dev \
       --name "database-connection-string-url-encoded-${env:?}" \
       --query 'value' \
       --output tsv
)

# SQL client
docker run --rm -it postgres:11 psql "${connection_string:?}"
```
