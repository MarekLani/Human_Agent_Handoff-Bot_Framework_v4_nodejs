// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const queueManager = require('./../queueManager')
const cosmosCommunicator = require('./../CosmosCommunicator');
const { ComponentDialog, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');

const WATERFALL_DIALOG = 'waterfallDialog';
const HANDOFF_DIALOG = "handoffDialog"

class HandoffDialog extends ComponentDialog {
    constructor(id,adapter) {
        super(id || HANDOFF_DIALOG);

        this.adapter = adapter;

        this.addDialog(new TextPrompt('TextPrompt'))
        .addDialog(new WaterfallDialog(WATERFALL_DIALOG, [
                this.waitForMessageStep.bind(this),
                this.handoffStep.bind(this),
            ]));

        this.initialDialogId = WATERFALL_DIALOG;
    }

    async waitForMessageStep(stepContext) {
        const context = stepContext.context;
        
        //Process message sent by user
        if(context.activity.channelId != "directline" || context.activity.from.id.indexOf("Agent") == -1){
            const sc = await cosmosCommunicator.getSupportCaseByUserConvId(context.activity.from.id,context.activity.conversation.id);

            //If no active support case for current user and for current conversation, we need to create one
            if(!sc || sc.status == cosmosCommunicator.CaseStatuses.Closed){
                //Write hand off request to queue
                await queueManager.EnqueueMessage(`{"userId":"${context.activity.from.id}","convId":"${context.activity.conversation.id}"}`);
                
                //Create Support case item in Cosmos DB
                await cosmosCommunicator.createSupportCase(context.activity.from.id,context.activity.conversation.id);

                return await stepContext.prompt('TextPrompt', {prompt:"Waitting for available agent, please wait"});
            }
            //If there is active support case
            else if(sc.status == cosmosCommunicator.CaseStatuses.Active){
                //Forward user message to agent
                const ref = await cosmosCommunicator.getAgentConvReference(sc.agentId);
                if(ref){
                    await this.adapter.continueConversation(ref, async (proactiveContext) => {
                        await proactiveContext.sendActivity(context.activity.text);
                    });
                }
            }
            //If there is support case closed by agent
            else if(sc.status == cosmosCommunicator.CaseStatuses.ClosedByAgent){
                await stepContext.context.sendActivity("thank you for your feedback");
                //Close Support case item
                cosmosCommunicator.changeSupportCaseStatus(sc,cosmosCommunicator.CaseStatuses.Closed);
                return await stepContext.endDialog();
            }
            //If user requests handoff again while support case is opened
            else
            {
                await stepContext.prompt('TextPrompt', {prompt:"We are doing what we can to get you an agent"});
            }
        }
        //Process message sent by agent
        else{
            const sc = await cosmosCommunicator.getOpenedSupportCaseByAgentId(context.activity.from.id);
            const ref = await cosmosCommunicator.getUserConvReference(sc.userId,sc.userConversationId);
            if(ref){
                
                //If message from agent equals "end" we are ending support case
                if(stepContext.context.activity.text == "end")
                {
 
                    //Send feedback prompting message to user 
                    cosmosCommunicator.changeSupportCaseStatus(sc,cosmosCommunicator.CaseStatuses.ClosedByAgent);
                    await this.adapter.continueConversation(ref, async (proactiveContext) => {
                        await proactiveContext.sendActivity("Case is closed now, please let us know, how satisfied you were from 1 to 10.");
                    });
                    //Send info message to agent
                    await stepContext.context.sendActivity("Support case succesfully closed, you can now close the window");
                    return await stepContext.endDialog();
                }
                //else forward agent message to user
                else{
                    await this.adapter.continueConversation(ref, async (proactiveContext) => {
                        await proactiveContext.sendActivity(context.activity.text);
                    });
                }
            }
        }
        return await stepContext.prompt('TextPrompt', {});
    }

    //Restart handoff dialog
    async handoffStep(stepContext) {
        return await stepContext.replaceDialog(HANDOFF_DIALOG);
    }
}

module.exports.HandoffDialog = HandoffDialog;
