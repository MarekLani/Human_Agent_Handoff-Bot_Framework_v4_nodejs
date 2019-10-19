// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { DialogBot } = require('./dialogBot');

class DialogAndWelcomeBot extends DialogBot {
    constructor(conversationState, userState, dialog, adapter) {
        super(conversationState, userState, dialog, adapter);

        this.adapter = adapter;

        this.onMembersAdded(async (context, next) => {
            //We don't want to welcome agent
            if(context.activity.from.id.indexOf('Agent') == -1){
                const membersAdded = context.activity.membersAdded;
                for (let cnt = 0; cnt < membersAdded.length; cnt++) {
                    if (membersAdded[cnt].id !== context.activity.recipient.id) {
                        await context.sendActivity("Welcome to Handoff Bot!");
                        await dialog.run(context, conversationState.createProperty('DialogState'));
                    }
                }
            }

            // By calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.DialogAndWelcomeBot = DialogAndWelcomeBot;