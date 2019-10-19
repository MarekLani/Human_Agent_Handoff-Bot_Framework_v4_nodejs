// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { InputHints } = require('botbuilder');
const { ComponentDialog, DialogTurnStatus } = require('botbuilder-dialogs');
const HANDOFF_DIALOG = "handoffDialog"

/**
 * This base class watches for common phrases like "help" and "cancel" and takes action on them
 * BEFORE they reach the normal bot logic.
 */
class InterruptableDialog extends ComponentDialog {
    async onContinueDialog(innerDc) {
        const result = await this.interrupt(innerDc);
        if (result) {
            return result;
        }
        return await super.onContinueDialog(innerDc);
    }

    async interrupt(innerDc) {
        if (innerDc.context.activity.text) {
            const text = innerDc.context.activity.text.toLowerCase();

            switch (text) {
            case 'help':
            case 'handoff':
                    return await innerDc.beginDialog(HANDOFF_DIALOG);
            case '?':
                const helpMessageText = 'Show help here and then continue with the dialog.';
                await innerDc.context.sendActivity(helpMessageText, helpMessageText, InputHints.ExpectingInput);
                return { status: DialogTurnStatus.waiting };
            case 'cancel':
            case 'quit':
                const cancelMessageText = 'I will cancel the current conversation and return to the main menu.';
                await innerDc.context.sendActivity(cancelMessageText, cancelMessageText, InputHints.IgnoringInput);
                return await innerDc.cancelAllDialogs();
            }
        }
    }
}

module.exports.InterruptableDialog = InterruptableDialog;
