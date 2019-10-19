
const CosmosClient  = require('@azure/cosmos').CosmosClient;
const uuidv4 = require('uuid/v4');

const cosmosConfig = 
{
    connectionString: process.env.COSMOS_CONNECTIONSTRING,
    database : process.env.COSMOS_DATABASE
}

const CaseStatuses =
{
    Waitting: "Waitting",
    Active: "Active",
    ClosedByAgent: "ClosedByAgent",
    Closed: "Closed"
}

const client = new CosmosClient(cosmosConfig.connectionString);
async function storeConversationReference(reference) {
    await client.database(cosmosConfig.database).container(process.env.COSMOS_CONVREFCONTAINER).items.upsert(reference);
}

async function getAgentConvReference(userId) {   
    // query to return all children in a family
    const querySpec = {
    query: "SELECT * FROM root r Where r.user.id = @userId ORDER BY r._ts DESC",
    parameters: [
            {
                name: "@userId",
                value: userId
            }
        ]
    };

    const { resources }  = await client.database(cosmosConfig.database).container(process.env.COSMOS_CONVREFCONTAINER).items.query(querySpec, {enableCrossPartitionQuery:true}).fetchAll();
    return (resources && resources.length > 0) ? resources[0] : null;
};

async function getUserConvReference(userId, convId) {   
    // query to return all children in a family
    const querySpec = {
    query: "SELECT * FROM root r Where r.user.id = @userId AND r.conversation.id = @convId ORDER BY r._ts DESC",
    parameters: [
            {
                name: "@userId",
                value: userId
            },
            {
                name: "@convId",
                value: convId
            }
        ]
    };

    const { resources }  = await client.database(cosmosConfig.database).container(process.env.COSMOS_CONVREFCONTAINER).items.query(querySpec, {enableCrossPartitionQuery:true}).fetchAll();
    return (resources && resources.length > 0) ? resources[0] : null;
};

async function createSupportCase(userId, userConversationId)
{
    var supportCase = 
    {
        agentId:"",
        userId:userId,
        supportCaseId:uuidv4(),
        status: CaseStatuses.Waitting,
        userConversationId: userConversationId
    }  
    await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).items.upsert(supportCase);
}

async function assignAgentToSupportCase(userId,agentId)
{
    //Cosmos doesn't support changing value for partion key field, and as agentId was selected as partition key, we need to recreate the item
    var sc = await getWaittingSupportCase(userId);
    await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).item(sc.id, "").delete();

    var supportCase = 
    {
        agentId:agentId,
        userId:userId,
        supportCaseId:sc.supportCaseId,
        status: CaseStatuses.Active,
        userConversationId: sc.userConversationId    
    }  
    
    await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).items.upsert(supportCase);
}

async function changeSupportCaseStatus(sc, status)
{
    var supportCase = 
    {
        id: sc.id,
        agentId:sc.agentId,
        userId:sc.userId,
        supportCaseId:sc.supportCaseId,
        status: status,
        userConversationId: sc.userConversationId    
    }  
    await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).item(sc.id, sc.agentId).replace(supportCase);
}

async function getWaittingSupportCase(userId) {   
    const querySpec = {
    query: "SELECT * FROM root r Where r.userId = @userId AND r.status = 'Waitting' ORDER BY r._ts ASC",
    parameters: [
            {
                name: "@userId",
                value: userId
            }
        ]
    };

    const { resources }  = await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).items.query(querySpec, {enableCrossPartitionQuery:true}).fetchAll();
    return (resources && resources.length > 0) ? resources[0] : null;
};

async function getOpenedSupportCaseByAgentId(agentId) {   
    const querySpec = {
    query: "SELECT * FROM root r Where  r.agentId = @agentId AND r.status = @status ",
    parameters: [
            {
                name: "@status",
                value: CaseStatuses.Active
            },
            {
                name: "@agentId",
                value: agentId
            }
        ]
    };

    const { resources }  = await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).items.query(querySpec, {enableCrossPartitionQuery:true}).fetchAll();
    return (resources && resources.length > 0) ? resources[0] : null;
};

async function getSupportCaseByUserConvId(userId,userConvId) {   
    const querySpec = {
    query: "SELECT * FROM root r Where r.userId = @userId AND r.userConversationId = @convId ORDER BY r._ts DESC",
    parameters: [
            {
                name: "@userId",
                value: userId
            },
            {
                name: "@convId",
                value: userConvId
            }
        ]
    };

    const { resources }  = await client.database(cosmosConfig.database).container(process.env.COSMOS_SUPPORTCASESCONTAINER).items.query(querySpec, {enableCrossPartitionQuery:true}).fetchAll();
    return (resources && resources.length > 0) ? resources[0] : null;
};

module.exports = {
    storeConversationReference,
    getAgentConvReference,
    getUserConvReference,
    createSupportCase,
    getOpenedSupportCaseByAgentId,
    getSupportCaseByUserConvId,
    assignAgentToSupportCase,
    changeSupportCaseStatus,
    CaseStatuses
}