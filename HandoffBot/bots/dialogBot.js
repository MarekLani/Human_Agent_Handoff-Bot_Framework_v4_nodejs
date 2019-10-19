// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const queueManager = require('./../queueManager')
const axios = require("axios");
const cosmosCommunicator = require('./../CosmosCommunicator');

const { ActivityHandler,ActivityTypes, TurnContext} = require('botbuilder');

// The accessor names for the conversation data and user profile state property accessors.
//const USER_LANGUAGE_PROPERTY = 'userLanguage';

class DialogBot extends ActivityHandler {

    /**
     *
     * @param {ConversationState} conversationState
     * @param {UserState} userState
     * @param {Dialog} dialog
     */
    constructor(conversationState, userState, dialog, adapter) {
        super();
        if (!conversationState) throw new Error('[DialogBot]: Missing parameter. conversationState is required');
        if (!userState) throw new Error('[DialogBot]: Missing parameter. userState is required');
        if (!dialog) throw new Error('[DialogBot]: Missing parameter. dialog is required');

        this.adapter = adapter;
        // Create the state property accessors for the user data.

        this.conversationState = conversationState;
        this.userState = userState;
        this.dialog = dialog;
        this.dialogState = this.conversationState.createProperty('DialogState');   
        this.userProfile = this.userState.createProperty('UserProfile');      

        this.onMessage(async (context, next) => {
            console.log('Running dialog with Message Activity.');

            //If you need to access user state here, this is how ...
            // const userLanguage = await this.userLanguage.get(context, {});
            // console.log(`userLanguage.langCode:${ userLanguage.langCode }.`);

            // Run the Dialog with the new message Activity.
            await this.dialog.run(context, this.dialogState);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onDialog(async (context, next) => {
            // Save any state changes. The load happened during the execution of the Dialog.
            await this.conversationState.saveChanges(context, false);
            await this.userState.saveChanges(context, false);

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });

        this.onTurn(async (context, next) => {

            //Store conversation reference
            if (context.activity.type == ActivityTypes.ConversationUpdate){
                if (context.activity.membersAdded.length !== 0) {
                    for (let idx in context.activity.membersAdded) {
                        if (context.activity.membersAdded[idx].id !== context.activity.recipient.id) { 
                            const reference = TurnContext.getConversationReference(context.activity);
                            await cosmosCommunicator.storeConversationReference(reference);
                        }
                    }
                }
            }

            //Create support case - agent is picking up the request
            if(context.activity.name === "webchat/join")
            {                              
                //We are going to interconnect agent with user
                var message = await queueManager.DequeueMessage()
                
                //If no message to dequeue
                if(message == "")
                {
                    await context.sendActivity("No work for you at this point");
                    return;
                }
                else{
                    // Message text is in results[0].messageText
                    var {userId, convId} = JSON.parse(message);
                    const ref = await cosmosCommunicator.getUserConvReference(userId,convId);
                    if(ref){
                        
                        //Map agent to support case
                        cosmosCommunicator.assignAgentToSupportCase(ref.user.id,context.activity.from.id);

                        //Load transcript from blob
                        //Path in storage has different encoding, need changes of path (specific for each channel!!!)
                        var escpaedConvId = ref.conversation.id
                        //Emulator
                        if(ref.channelId == "emulator")
                            escpaedConvId = ref.conversation.id.replace("|","%7C");
                        //Teams
                        if(ref.channelId == "teams")
                            escpaedConvId = ref.conversation.id.replace(":","%3A");

                        const response = await axios({
                            method: 'post',
                            url: process.env.LIST_TRANSCRIPTS_URI,
                            data: `{"container":"${process.env.TRANSCRIPTS_CONTAINER}","path":"${ref.channelId}/${escpaedConvId}"}`,
                            headers: {
                            'content-type': `application/javascript`,
                            },
                        });
                        for (const element of response.data) {
                            const transcript = await axios({
                                method: 'post',
                                url: process.env.DOWNLOAD_ACTIVITY_URI,
                                data: `{"blobUri":"${element.uri}"}`,
                                headers: {
                                'content-type': `application/javascript`,
                                },
                            });
                            if(transcript.data.type != ActivityTypes.ConversationUpdate){
                                
                                if(transcript.data.type == ActivityTypes.Message)
                                {
                                    //Adding prefix to history messages, so agent can recognize if message was sent by bot or user
                                    if(transcript.data.from.role === "bot")
                                        transcript.data.text = "**BOT:** "+ transcript.data.text;
                                    else
                                        transcript.data.text = "USER:"+ref.user.name+" "+ transcript.data.text;
                                }
                                delete transcript.data.timestamp
                                await context.sendActivity(transcript.data);
                            }
                        }

                        await this.adapter.continueConversation(ref, async (context) => {
                            await context.sendActivity("Hello I am agent and I am going to help you");
                        });
                    } 
                }
            }
            await next();
        })
       
    }
}

module.exports.DialogBot = DialogBot;