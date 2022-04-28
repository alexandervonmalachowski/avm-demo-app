#!/usr/bin/env sh
#
# Usage:
#    infrastructure/app-deploy.sh <environment-name> 
#   [<app_suffix>] 
#   [<subscription>] 
#   [<app_registration>] 

# The environment which should be deployed to must already exist.
#
# Example:#   
#     infrastructure/app-deploy.sh dev

# Abort on failures
set -eu

# Always run from `{scriptlocation}/..`, one level up from `infrastucture`. (frontend root)
cd "$(dirname "$0")/.."

# Input and variables
env=${1:?}
app_suffix=${2:-'be'}
sub=${3:-'mr-creative-tech'}
app_registration=${4:-'ar-avm-demo'}
group_env="rg-avmdemoapp-${env}"
version="$(git show --no-patch --format='%cs_%h' HEAD)"

# Deployment template parameters
containerRegistryName="cravmdemoapp$env"
containerImageName="avmdemoapp-$app_suffix"
containerImageVersion="$version"
containerImage="$containerRegistryName.azurecr.io/$containerImageName:$containerImageVersion"
keyVaultUrl="https://kv-avmdemoapp-$env.vault.azure.net"
keyVaultName="kv-avmdemoapp-$env"
aadClientId=$(az ad sp list --display-name "$app_registration" --query [].appId --output tsv)

# Verify git status, required since the hash is used as version
if [ "$(git status --short)" != '' ]; then
    git status
    echo
    echo "ABORTING: Deployment requries a clean git status..."
    exit 1
fi

# Verify that only accepted commits gets deployed to "higher" environments
case "$env" in
    prod)
        requiredBranch="prod-be"
        requiredParent="qa-be"
        ;;
    qa)
        requiredBranch="qa-be"
        requiredParent="main"
        ;;
    dev)
        requiredBranch="main"
        requiredParent="*"
        ;;
esac

if [ "$env" != 'unstable' ]; then
    # Validate required branch tip
    if [ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$requiredBranch")" ] ; then
        echo "checkout is on 'origin/${requiredBranch}' tip"
    else
        echo "ABORTING: Deployments to '$env' environment MUST come from tip of 'origin/${requiredBranch}'"
        exit 1
    fi

    # Validate requried parent
    if [ "$requiredParent" = "*" ] ; then
        echo "required parent is '*', no valdiation required"
    else
        # Fetch first, to enable validation
        git fetch --quiet --depth=1 origin "$requiredParent"
        git log --oneline --decorate --graph --all

        echo "validating parent 'origin/$requiredParent'"
        if ! git cat-file -p HEAD | grep "parent $(git rev-parse "origin/$requiredParent")" ; then
            echo "ABORTING: Deployments to '$env' environment MUST come from a MERGE commit beween ${requiredBranch} and ${requiredParent}"
            exit 1
        fi
    fi
fi


# Login to azure if required
if ! az account show > /dev/null
then
    echo "ABORTING: Azure login must be done before deployment"
    exit 1
fi
az account set --subscription "$sub" > /dev/null

if [ "$(az group exists --resource-group "$group_env")" = 'false' ]; then
    echo "ABORTING: Can't deploy to non existing resource group '$group_env'"
    exit 1
fi
echo "Subscription: $(az account show --query 'name' --output tsv)"
echo "ResourceGroup: $group_env"
echo "ContainerImage: $containerImage"


# Build
echo
docker build -t "$containerImage" .

# Login and push
echo
az acr login -n "$containerRegistryName"
docker push "$containerImage"

aadClientId=$(az ad sp list --display-name "$app_registration" --query [].appId --output tsv)
# Run deployment commands
# TODO: Include 'what-if' once https://github.com/Azure/arm-template-whatif/issues/65 is fixed.
echo
echo "validate..."

az deployment group validate \
    --resource-group "$group_env" \
    --template-file infrastructure/app-template-deploy.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=$env" \
    --parameters "containerImageName=$containerImageName" \
    --parameters "containerRegistryName=$containerRegistryName" \
    --parameters "containerImageVersion=$containerImageVersion" \
    --parameters "keyVaultUrl=$keyVaultUrl" \
    --parameters "keyVaultName=$keyVaultName" \
    --parameters "aadClientId=$aadClientId" \
    --parameters "withPostgre=true" \
    --parameters "appSuffix=$app_suffix" 

echo 
echo "create..."

az deployment group create \
    --resource-group "$group_env" \
    --template-file infrastructure/app-template-deploy.json \
    --parameters @infrastructure/parameters.json \
    --parameters "environmentName=$env" \
    --parameters "containerImageName=$containerImageName" \
    --parameters "containerRegistryName=$containerRegistryName" \
    --parameters "containerImageVersion=$containerImageVersion" \
    --parameters "keyVaultUrl=$keyVaultUrl" \
    --parameters "keyVaultName=$keyVaultName" \
    --parameters "aadClientId=$aadClientId" \
    --parameters "withPostgre=true" \
    --parameters "appSuffix=$app_suffix" \
    --output table

# Print success with endpoint
endpoint=$(
    az deployment group show \
        --resource-group "$group_env" \
        --name 'app-template-deploy' \
        --query 'properties.outputs.hostNames.value[0]' \
        --output tsv
)
echo
echo "Sucessfully deployed to environment"
echo "> $containerRegistryName"
echo "> $endpoint"
