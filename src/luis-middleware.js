const request = require('request');

function receive(options) {
  if (!options || !options.serviceUri) {
    throw new Error('No LUIS service url specified.');
  }

  let serviceUri = options.serviceUri.trim();
  console.log(serviceUri.length);
  if (serviceUri.lastIndexOf('&q=') !== serviceUri.length - 3) {
    serviceUri += '&q=';
  }
  const minThreshold = options.minThreshold || 0.1;
  const captureThreshold = options.captureThreshold || 0.7;
  return (bot, message, next) => {
    // We will only process the text and either there's no topIntent
    // or the score for the topIntent is below the captureThreshold.
    if (
      message.text &&
      (!message.topIntent || message.topIntent.score < captureThreshold)
    ) {
      const uri = serviceUri + encodeURIComponent(message.text);
      request.get(uri, (err, res, body) => {
        try {
          if (!err) {
            const result = JSON.parse(body);

            if (result.topScoringIntent) {
              // API v2.0
              message.topIntent = result.topScoringIntent;
              message.entities = result.entities || [];
              message.action =
                result.topScoringIntent.actions &&
                result.topScoringIntent.actions[0].triggered
                  ? result.topScoringIntent.actions[0]
                  : null;
            } else {
              // API v1.0

              // Intents for the builtin Cortana app don't return a score.
              if (
                result.intents.length === 1 &&
                !result.intents[0].hasOwnProperty('score')
              ) {
                result.intents[0].score = 1.0;
              }

              // Find top intent
              // - Only return entities for the model with the top intent.
              for (let i = 0; i < result.intents.length; i++) {
                const intent = result.intents[i];
                if (
                  intent.score > minThreshold &&
                  (!message.topIntent || intent.score > message.topIntent.score)
                ) {
                  message.topIntent = intent;
                  message.entities = result.entities || [];
                  message.action =
                    intent.actions && intent.actions[0].triggered
                      ? intent.actions[0]
                      : null;
                }
              }
            }
          } else {
            console.error(err.toString());
          }
        } catch (e) {
          console.error(e.toString());
        }
        next();
      });
    } else {
      next();
    }
  };
}

function hereIntent(tests, message) {
  if (message.topIntent) {
    const intent = message.topIntent.intent.toLowerCase();
    for (let i = 0; i < tests.length; i++) {
      if (intent.match(tests[i])) {
        // allows for specific string or regex
        return true;
      }
    }
  }
  return false;
}

function hereAction(tests, message) {
  if (message.action) {
    const action = message.action.name.toLowerCase();
    for (let i = 0; i < tests.length; i++) {
      if (action.match(tests[i])) {
        // allows for specific string or regex
        return true;
      }
    }
  }
  return false;
}

module.exports = {
  middleware: {
    receive,
    hereIntent,
    hereAction,
  },
};
