#!/usr/bin/env sh
#
# Usage:
#     infrastructure/app-create-secrets.sh <environmentname> 
#    [<app_suffix>] 
#    [<subscription>]  
#     [<group_env>]  
#     [<key_vault>]
#
# Environment variable inputs.
# All of these have defaults
#     app_suffix
#     subscription
#     group_env  
#     key_vault
#
# Example:
#     infrastructure/app-create-secrets.sh dev



# Abort on failures
set -e

# Always run from `{scriptlocation}/..`, one level up from `infrastucture`. (frontend root)
cd "$(dirname "$0")/.."

# Input and variables
env=${1:?}
app_suffix=${2:-'be'}
sub=${3:-'mr-creative-tech'}
group_env="rg-avmdemoapp-$env"
key_vault=${key_vault:-'kv-avmdemoapp-'$env}

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

for cmd in 'validate' 'create' ; do
    echo
    echo "$cmd..."
     az deployment group $cmd \
        --resource-group "${group_env:?}" \
        --template-file infrastructure/app-template-secrets-be.json \
        --parameters "keyVaultName=${key_vault:?}" \
        --parameters "environmentName=${env:?}" \
        --parameters "appSuffix=$app_suffix" \
        --parameters "apiSecrets={\"token_url\":\"TBD\",\"client_id\":\"TBD\",\"client_secret\":\"TBD\",\"scope\":\"TBD\"}"
done

az deployment group show \
    --resource-group "${group_env:?}" \
    --name 'app-template-secrets-be' \
    --output table
