// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

// index.js is used to setup and configure your bot

// Import required packages
const path = require('path');
const restify = require('restify');
const request = require('request');

// Note: Ensure you have a .env file and include LuisAppId, LuisAPIKey and LuisAPIHostName.
const ENV_FILE = path.join(__dirname, '.env');
require('dotenv').config({ path: ENV_FILE });

// Import required bot services. See https://aka.ms/bot-services to learn more about the different parts of a bot.
const { BotFrameworkAdapter, ConversationState, InputHints, UserState } = require('botbuilder');
const { CosmosDbStorage, AzureBlobTranscriptStore } = require("botbuilder-azure");
const { TranscriptLoggerMiddleware } = require('botbuilder-core');


const { DialogAndWelcomeBot } = require('./bots/dialogAndWelcomeBot');

// This bot's main dialog.
const { MainDialog } = require('./dialogs/mainDialog');

const { HandoffDialog } = require('./dialogs/handoffDialog');
const HANDOFF_DIALOG = 'handoffDialog';


// Create adapter.
// See https://aka.ms/about-bot-adapter to learn more about adapters.
const adapter = new BotFrameworkAdapter({
    appId: process.env.MicrosoftAppId,
    appPassword: process.env.MicrosoftAppPassword
});

// Catch-all for errors.
adapter.onTurnError = async (context, error) => {
    // This check writes out errors to console log
    // NOTE: In production environment, you should consider logging this to Azure
    //       application insights.
    console.error(`\n [onTurnError]: ${ error }`);
    // Send a message to the user
    const onTurnErrorMessage = `Sorry, it looks like something went wrong!`;
    await context.sendActivity(onTurnErrorMessage, onTurnErrorMessage, InputHints.ExpectingInput);
    // Clear out state
    await conversationState.delete(context);
};


// The transcript store has methods for saving and retrieving bot conversation transcripts.
let transcriptStore = new AzureBlobTranscriptStore({storageAccountOrConnectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
                                                    containerName: process.env.TRANSCRIPTS_CONTAINER
                                                    });
                                                    
// Create the middleware layer responsible for logging incoming and outgoing activities
// into the transcript store.
var transcriptMiddleware = new TranscriptLoggerMiddleware(transcriptStore);
adapter.use(transcriptMiddleware);

// Create access to CosmosDb Storage - this replaces local Memory Storage.
var cosmosStorage = new CosmosDbStorage({
    serviceEndpoint: process.env.COSMOS_ENDPOINT, 
    authKey: process.env.COSMOS_KEY, 
    databaseId: process.env.COSMOS_DATABASE,
    collectionId: process.env.COSMOS_STATECONTAINER
})

const conversationState = new ConversationState(cosmosStorage);
const userState = new UserState(cosmosStorage);

// Create the main dialog.

const handoffDialog = new HandoffDialog(HANDOFF_DIALOG,adapter)
const dialog = new MainDialog(handoffDialog, userState);
const bot = new DialogAndWelcomeBot(conversationState,userState, dialog, adapter);

// Create HTTP server
const server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function() {
    console.log(`\n${ server.name } listening to ${ server.url }`);
});

//To be able to request Direct Line token, needs to be set on Web App as well
server.use(
    function crossOrigin(req,res,next){
      res.header("Access-Control-Allow-Origin", "*");
      res.header("Access-Control-Allow-Headers", "X-Requested-With");
      return next();
    }
  );

// Listen for incoming activities and route them to your bot main dialog.
server.post('/api/messages', (req, res) => {
    // Route received a request to adapter for processing
    adapter.processActivity(req, res, async (turnContext) => {
       
        await bot.run(turnContext);
    });
});


//Request directline token
server.post('/api/getdirectlinetoken',(req,res) =>
{
    const options = {
        method: 'POST',
        uri: 'https://directline.botframework.com/v3/directline/tokens/generate',
        headers: {
            'Authorization': 'Bearer ' + process.env.DIRECTLINE_SECRET
        },
        json: {
            User: { Id: "Agent" }
        }
    };

    request.post(options, (error, response, body) => {
        if (!error && response.statusCode < 300) {
            res.json({ 
                    token: body.token,
                    userId: "Agent"
                });
        }
        else {
            res.status(500).send('Call to retrieve token from Direct Line failed');
        } 
    });
})

