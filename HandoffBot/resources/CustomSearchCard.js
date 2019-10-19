
const {CardFactory,ActionTypes, AttachmentLayoutTypes} = require('botbuilder')

function customSearchAdaptiveCard(textValue, displayUrl, graphicUrl){
    var card = CardFactory.adaptiveCard({
        "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
        "type": "AdaptiveCard",
        "version": "1.0",
        "minHeight":"250px",
        "body": [
          {
            "type": "Container",
            "items": [
                {
                  "type": "Image",
                  "height":"200px",
                   "url": graphicUrl  
                },
              {
                "type": "TextBlock",
                "text": textValue,
                "wrap":"true",
                "maxLines":"5"
              }
            ]
          }
          
        ],
        "actions": [
          {
            "type": "Action.OpenUrl",
            "title": "Know More",
            "url": displayUrl
            }
        ]
      });
      return  card;
}

exports.customSearchAdaptiveCard = customSearchAdaptiveCard;