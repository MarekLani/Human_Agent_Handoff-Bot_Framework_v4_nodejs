// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.
const { MessageFactory, InputHints } = require('botbuilder');
const { DialogSet, DialogTurnStatus, TextPrompt, WaterfallDialog } = require('botbuilder-dialogs');
const { InterruptableDialog} = require('./interruptableDialog');

const MAIN_WATERFALL_DIALOG = 'mainWaterfallDialog';
const HANDOFF_DIALOG = "handoffDialog"


class MainDialog extends InterruptableDialog {
    constructor(handoffDialog, userState) {
        super('MainDialog');

        if (!handoffDialog) throw new Error('[MainDialog]: Missing parameter \'handoffDialog\' is required');

        // Define the main dialog and its related components.
        this.addDialog(new TextPrompt('TextPrompt'))
            .addDialog(handoffDialog)
            .addDialog(new WaterfallDialog(MAIN_WATERFALL_DIALOG, [
                this.introStep.bind(this),
                this.finalStep.bind(this)
            ]));

        this.initialDialogId = MAIN_WATERFALL_DIALOG;
    }

    /**
     * The run method handles the incoming activity (in the form of a TurnContext) and passes it through the dialog system.
     * If no dialog is active, it will start the default dialog.
     * @param {*} turnContext
     * @param {*} accessor
     */
    async run(turnContext, accessor) {
        const dialogSet = new DialogSet(accessor);
        dialogSet.add(this);

        const dialogContext = await dialogSet.createContext(turnContext);
        const results = await dialogContext.continueDialog();
        if (results.status === DialogTurnStatus.empty) {
            await dialogContext.beginDialog(this.id);
        }
    }
    /**
     * First step in the waterfall dialog. Prompts the user for a command.
     */
    async introStep(stepContext) {

        if(stepContext.context.activity.from.id.indexOf('Agent') > -1)
        {
            //Agent
            return await stepContext.replaceDialog(HANDOFF_DIALOG);
        }
        
        const messageText = stepContext.options.restartMsg ? stepContext.options.restartMsg : 'How can I help?';
        const promptMessage = MessageFactory.text(messageText, messageText, InputHints.ExpectingInput);
        return await stepContext.prompt('TextPrompt', { prompt: promptMessage });
    }


    /**
     * This is the final step in the main waterfall dialog.
     */
    async finalStep(stepContext) {
        // Restart the main dialog
        return await stepContext.replaceDialog(this.initialDialogId);
    }
}

module.exports.MainDialog = MainDialog;