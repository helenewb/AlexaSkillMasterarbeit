const Alexa = require('ask-sdk-core');
const i18n = require('i18next');
var parseDuration = require("parse-duration");

const languageStrings = require('./messages');

const HOTELS = ['H_ZENTRAL', 'H_POST', 'H_ALTWIEN'];

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        let response = handlerInput.responseBuilder;
        if(hasScreenSupport(handlerInput)) {
            const template = "BodyTemplate1";
            const title = handlerInput.t('WELCOME_DISPLAY_TITLE');
            const text = handlerInput.t('WELCOME_DISPLAY_TEXT');
            response = getDisplay(response, template, '', title, text);
        }
        return response.speak(handlerInput.t('WELCOME')).reprompt(handlerInput.t('HOW_CAN_I_HELP')).getResponse();
    }
};

const SetTimerIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'SetTimer';
    },
    handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;

        let duration = slots.duration.value;
        let durationMs = parseDuration(duration);
        let durationMin = parseInt(durationMs / 1000 / 60);

        let text = handlerInput.t('TIMER_DONE', [durationMin]);
        let response = handlerInput.responseBuilder;

        if(hasScreenSupport(handlerInput)) {
            const template = "BodyTemplate2";
            const imageUrl = handlerInput.t('IMG_TIMER');
            const title = handlerInput.t('TIMER_DISPLAY_TITLE');
            const text = handlerInput.t('TIMER_DISPLAY_TEXT', [durationMin]);
            response = getDisplay(response, template, imageUrl, title, text);
        }
        return response.speak(text).getResponse();
    }
};

const TableReservationIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'TableReservation';
    },
    handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;

        let time = slots.time.value;
        let guests = slots.guests.value;
        let restaurant = getSlotResolution(slots, 'restaurant', 'name');

        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        sessionAttributes.confirmed = false;
        sessionAttributes.restaurantReservation = {
            time: time,
            guests: guests,
            restaurant: restaurant
        };

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
        return confirmRestaurant(handlerInput, sessionAttributes)
    }
};

const HotelSearchIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HotelSearch';
    },
    handle(handlerInput) {
        let text = handlerInput.t('HOTEL_SEARCH_DONE');
        let response = clearSession(handlerInput).responseBuilder;

        if(hasScreenSupport(handlerInput)) {
            response = addHotelSelectionScreen(handlerInput, response);
        }
        return response.speak(text).reprompt(handlerInput.t('HOTEL_SELECTION_SHORT')).getResponse();
    }
};

const HotelDetailIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'HotelDetail';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        let hotel = getHotel(slots);

        let text = undefined;
        let response = handlerInput.responseBuilder;

        if(hotel) {
            text = handlerInput.t('HOTEL_SELECTION_DISPLAY_TEXT_' + hotel);
            let detailText = handlerInput.t('HOTEL_SELECTION_DISPLAY_DETAIL_' + hotel);

            sessionAttributes.hotel = hotel;
            sessionAttributes.confirmed = false;
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
            text += ' ' + handlerInput.t('WANT_TO_BOOK');

            if(hasScreenSupport(handlerInput)) {
                const template = "BodyTemplate2";
                const imageUrl = handlerInput.t('IMG_' + hotel);
                response = getDisplay(response, template, imageUrl, handlerInput.t('NAME_' + hotel), detailText);
            }
        } else {
            text = handlerInput.t('HOTEL_SELECTION_SHORT');
        }
        return response.speak(text).reprompt(text).getResponse();
    }
};

const confirmRestaurant = function (handlerInput, sessionAttributes) {
    let restaurant = sessionAttributes.restaurantReservation.restaurant;
    let guests = sessionAttributes.restaurantReservation.guests;
    let time = sessionAttributes.restaurantReservation.time;

    let text = handlerInput.t(sessionAttributes.confirmed ? 'RESTAURANT_DONE' : 'RESTAURANT_CONFIRM', [restaurant, guests, time]);
    let response = handlerInput.responseBuilder;

    if(hasScreenSupport(handlerInput)) {
        const template = "BodyTemplate3";
        const imageUrl = handlerInput.t('IMG_RESTAURANT');
        const title = handlerInput.t(sessionAttributes.confirmed ? 'RESTAURANT_DISPLAY_TITLE' : 'RESTAURANT_CONFIRM_DISPLAY_TITLE');
        const text = handlerInput.t(sessionAttributes.confirmed ? 'RESTAURANT_DISPLAY_TEXT' : 'RESTAURANT_CONFIRM_DISPLAY_TEXT', [restaurant, guests, time]);
        response = getDisplay(response, template, imageUrl, title, text);
    }

    if(!sessionAttributes.confirmed) {
        sessionAttributes.confirmed = true;
        return response.speak(text).reprompt(text).getResponse();
    } else {
        return response.speak(text).getResponse();
    }
};

const confirmHotel = function (handlerInput, sessionAttributes) {
    let hotel = sessionAttributes.hotel;

    let text = handlerInput.t(sessionAttributes.confirmed ? 'BOOKING_TEXT' : 'CONFIRMATION_TEXT', [handlerInput.t('NAME_' + hotel), handlerInput.t('PRICE_' + hotel)]);
    let response = handlerInput.responseBuilder;

    if(hasScreenSupport(handlerInput)) {
        const template = "BodyTemplate3";
        const imageUrl = handlerInput.t('IMG_' + hotel);
        const title = handlerInput.t(sessionAttributes.confirmed ? 'CONFIRM_BOOKING_DISPLAY_TITLE' : 'CONFIRM_SELECTION_DISPLAY_TITLE');
        response = getDisplay(response, template, imageUrl, title, text);
    }

    if(!sessionAttributes.confirmed) {
        sessionAttributes.confirmed = true;
        return response.speak(text).reprompt(text).getResponse();
    } else {
        return response.speak(text).getResponse();
    }
};

const YesIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        if(sessionAttributes.restaurantReservation) {
            return confirmRestaurant(handlerInput, sessionAttributes);
        }

        if(sessionAttributes.hotel) {
            return confirmHotel(handlerInput, sessionAttributes)
        }

        return FallbackIntentHandler.handle(handlerInput);
    }
};

const NoIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        if(sessionAttributes.restaurantReservation) {
            let text = handlerInput.t('HOW_CAN_I_HELP');
            let response = clearSession(handlerInput).responseBuilder;

            if(hasScreenSupport(handlerInput)) {
                const template = "BodyTemplate1";
                const text = handlerInput.t('HOW_CAN_I_HELP');
                response = getDisplay(response, template, '', '', text);
            }
            return response.speak(text).reprompt(text).getResponse();
        }

        if(sessionAttributes.hotel) {
            let text = handlerInput.t('HOTEL_SELECTION_SHORT');
            let response = clearSession(handlerInput).responseBuilder;

            response = addHotelSelectionScreen(handlerInput, response);
            return response.speak(text).reprompt(text).getResponse();
        }

        return FallbackIntentHandler.handle(handlerInput);
    }
};

const BookHotelIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'BookHotel';
    },
    handle(handlerInput) {
        const slots = handlerInput.requestEnvelope.request.intent.slots;
        let hotel = getHotel(slots);
        if(!hotel) {
            return handlerInput.responseBuilder.speak(handlerInput.t('HOTEL_BOOK_SHORT')).reprompt('HOTEL_BOOK_REPROMPT').getResponse();
        }

        let text = handlerInput.t('BOOKING_TEXT', [hotel, handlerInput.t('PRICE_' + hotel)]);
        return handlerInput.responseBuilder.speak(text).getResponse();
    }
};

const addHotelSelectionScreen = function (handlerInput, response) {
    const template = "ListTemplate2";
    const title = handlerInput.t('HOTEL_SELECTION_DISPLAY_TITLE');
    const listItems = [];
    HOTELS.forEach(element => {
        listItems.push({
            token: element,
            image: new Alexa.ImageHelper().addImageInstance(handlerInput.t('IMG_' + element)).getImage(),
            textContent: new Alexa.RichTextContentHelper()
                .withPrimaryText(handlerInput.t('NAME_' + element))
                .withSecondaryText(handlerInput.t('PRICE_' + element))
                .getTextContent()
        })
    });
    response = getDisplay(response, template, '', title, '', '', listItems);
    return response;
};

const getDisplay = function(response, template, imageUrl, title, text, subTitle, listItems) {
    const image = new Alexa.ImageHelper().addImageInstance(imageUrl).getImage();
    const richText = new Alexa.RichTextContentHelper()
        .withPrimaryText(subTitle)
        .withSecondaryText(text)
        .getTextContent();

    if (template === 'ListTemplate2') {
        response.addRenderTemplateDirective({
            type: template,
            backButton: 'visible',
            title: title,
            listItems: listItems
        });
    } else {
        response.addRenderTemplateDirective({
            type: template,
            backButton: 'visible',
            image: image,
            title: title,
            textContent: richText,
        });
    }

    return response
};

const clearSession = function (handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    delete sessionAttributes.hotel;
    delete sessionAttributes.confirmed;
    delete sessionAttributes.restaurantReservation;
    handlerInput.attributesManager.setSessionAttributes(sessionAttributes);
    return handlerInput;
};

const getHotel = function (slots) {
    let hotel = getSlotResolution(slots, 'hotel', 'id');
    if(!hotel && slots.number && slots.number.value){
        let number = parseInt(slots.number.value);
        if(number > 0 && number < 4) {
            hotel = HOTELS[number-1];
        }
    }
    return hotel;
};

const hasScreenSupport = function(handlerInput) {
    return handlerInput.requestEnvelope.context &&
        handlerInput.requestEnvelope.context.System &&
        handlerInput.requestEnvelope.context.System.device &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display;
};

const getSlotResolution = function (slots, name, attr) {
    if (slots[name].resolutions &&
        slots[name].resolutions.resolutionsPerAuthority &&
        slots[name].resolutions.resolutionsPerAuthority[0] &&
        slots[name].resolutions.resolutionsPerAuthority[0].values &&
        slots[name].resolutions.resolutionsPerAuthority[0].values[0] &&
        slots[name].resolutions.resolutionsPerAuthority[0].values[0].value &&
        slots[name].resolutions.resolutionsPerAuthority[0].values[0].value[attr]) {
        return slots[name].resolutions.resolutionsPerAuthority[0].values[0].value[attr];
    }
    if(slots[name]) {
        return slots[name].value;
    }
    return undefined;
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.speak(handlerInput.t('HELP')).reprompt(handlerInput.t('HOW_CAN_I_HELP')).getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        return clearSession(handlerInput).responseBuilder.speak(handlerInput.t('STOP')).withShouldEndSession(true).getResponse();
    }
};

const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        return handlerInput.responseBuilder.speak(handlerInput.t('FALLBACK')).reprompt('FALLBACK_REPROMPT').getResponse();
    }
};

const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        return clearSession(handlerInput).responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);
        return clearSession(handlerInput).responseBuilder.speak(handlerInput.t('ERROR')).getResponse();
    }
};

const LocalisationRequestInterceptor = {
    process(handlerInput) {
        i18n.init({
            lng: Alexa.getLocale(handlerInput.requestEnvelope),
            resources: languageStrings,
            returnObjects: true
        }).then((t) => {
            handlerInput.t = (...args) => t(...args);
        });
    }
};

exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        SetTimerIntentHandler,
        TableReservationIntentHandler,
        BookHotelIntentHandler,
        HotelSearchIntentHandler,
        HotelDetailIntentHandler,
        HelpIntentHandler,
        YesIntentHandler,
        NoIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,)
    // .addErrorHandlers(
    //     ErrorHandler)
    .addRequestInterceptors(
        LocalisationRequestInterceptor)
    .lambda();