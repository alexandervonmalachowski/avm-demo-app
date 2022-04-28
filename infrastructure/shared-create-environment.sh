#!/usr/bin/env sh
#
# Usage:
#     infrastructure/shared-create-environment.sh <environmentname> [<subscription>]#     
#     [<group_env>]  
#     [<container_registry>]
#     [<key_vault>]
#
# Environment variable inputs.
# All of these have defaults
#     subscription
#     group_env  
#     container_registry
#     key_vault
#
# Example:
#     infrastructure/shared-create-environment.sh dev



# Abort on failures
set -e

# Always run from `{scriptlocation}/..`, one level up from `infrastucture`. (frontend root)
cd "$(dirname "$0")/.."

# Input and variables
env=${1:?}
sub=${2:-'mr-creative-tech'}
group_env="rg-avmdemoapp-$env"
container_registry=${container_registry:-'cravmdemoapp'$env}
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
        --template-file infrastructure/shared-template-environment.json \
        --parameters @infrastructure/parameters.json \
        --parameters "environmentName=${env:?}" \
        --parameters "containerRegistryName=${container_registry:?}" \
        --parameters "keyVaultName=${key_vault:?}"
done

az deployment group show \
    --resource-group "${group_env:?}" \
    --name 'shared-template-environment' \
    --output table