#!/usr/bin/env sh
#
# Usage:
#     infrastructure/app-create-environment.sh <environmentname> 
#     [<app_suffix>] 
#     [<subscription>]
#     [<group_env>]  
#     [<app_registration>]
#     [<container_registry>]
#     [<key_vault>]
#
# Environment variable inputs.
# All of these have defaults
#     app_suffix
#     subscription
#     group_env  
#     app_registration
#     container_registry
#     key_vault
#
# Example:
#     infrastructure/app-create-environment.sh dev



# Abort on failures
set -e

# Always run from `{scriptlocation}/..`, one level up from `infrastucture`. (frontend root)
cd "$(dirname "$0")/.."

# Input and variables
env=${1:?}
app_suffix=${2:-'be'}
sub=${3:-'mr-creative-tech'}
group_env="rg-avmdemoapp-$env"
app_registration="ar-avm-demo"
key_vault=${key_vault:-'kv-avmdemoapp-'$env}


# Yes, we regenerate and update the password for each environment deployment
username='avmdemoapp'
password="$(cat /dev/random | head -c 48 | base64)"

# Login to azure if required
if ! az account show > /dev/null
then
    echo "ABORTING: Azure login must be done before deployment"
    exit 1
fi
az account set --subscription "$sub" > /dev/null
echo "Subscription: $(az account show --query 'name' --output tsv)"
echo "ResourceGroup: $group_env"

# Create group if not existing
if ! az group show --name "$group_env" > /dev/null
then
    az group create --location 'westeurope' --name "$group_env"
fi

objectId=$(az ad sp list --display-name "$app_registration" --query [].objectId --output tsv)

for cmd in 'validate' 'create' ; do
    echo
    echo "$cmd..."
    az deployment group $cmd \
        --resource-group "${group_env:?}" \
        --template-file infrastructure/app-template-environment-be.json \
        --parameters @infrastructure/parameters.json \
        --parameters "environmentName=${env:?}" \
        --parameters "keyVaultName=${key_vault:?}" \
        --parameters "appSuffix=$app_suffix" \
        --parameters "databaseAdministratorLogin=${username:?}" \
        --parameters "databaseAdministratorLoginPassword=${password:?}" \
        --parameters "withPostgre=true" \
        --parameters "objectId=${objectId:?}"
done

az deployment group show \
    --resource-group "${group_env:?}" \
    --name 'app-template-environment-be' \
    --output table

az deployment group show \
    --resource-group "${group_env:?}" \
    --name "app-psql-template-environment-kv-$app_suffix-$env" \
    --output table