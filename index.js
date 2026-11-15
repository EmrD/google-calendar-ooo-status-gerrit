const { google } = require('googleapis');

module.exports = async function (context, req) {
    const clientId = "";
    const clientSecret = "";
    const refreshToken = "";
    
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oAuth2Client.setCredentials({ refresh_token: refreshToken });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
    const now = new Date();
    const trDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Europe/Istanbul' });
    
    const startOfDay = `${trDateStr}T00:00:00+03:00`;
    const endOfDay = `${trDateStr}T23:59:59+03:00`;

    const updateGerrit = async (isOoo) => {
        const username = ""; 
        const token = "";
            
        const authHeader = 'Basic ' + Buffer.from(`${username}:${token}`).toString('base64');
        const displayName = isOoo ? "Emir Düz (OOO today)" : "Emir Düz";

        const response = await fetch("https://chromium-review.googlesource.com/a/accounts/self/displayname", {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json; charset=UTF-8',
                'Authorization': authHeader
            },
            body: JSON.stringify({
                display_name: displayName 
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gerrit HTTP: ${response.status} - ${errorText}`);
        }

        let text = await response.text();
        if (text.startsWith(")]}'")) {
            text = text.substring(4);
        }
        return text;
    };

    try {
        const calendarResponse = await calendar.events.list({
            calendarId: 'primary',
            timeMin: startOfDay,
            timeMax: endOfDay,
            timeZone: 'Europe/Istanbul',
            singleEvents: true,
            orderBy: 'startTime',
        });

        const events = calendarResponse.data.items || [];

        let oooEvent = null;
        for (const event of events) {
            if (event.status === 'cancelled') continue;

            const isOooType = event.eventType === 'outOfOffice';
            const summaryLower = (event.summary || '').toLowerCase();
            const hasOooWord = /\booo\b/.test(summaryLower);
            const isOooTitle = hasOooWord || summaryLower.includes('out of office');

            if (isOooType || isOooTitle) {
                oooEvent = event;
                break;
            }
        }

        const isOoo = Boolean(oooEvent);
        await updateGerrit(isOoo);

        context.res = {
            status: 200,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                success: true,
                checkedDateTR: trDateStr,
                isOoo: isOoo,
                matchedEvent: oooEvent ? {
                    summary: oooEvent.summary,
                    start: oooEvent.start,
                    end: oooEvent.end,
                    eventType: oooEvent.eventType
                } : null,
                allEventsToday: events.map(e => ({
                    summary: e.summary,
                    start: e.start,
                    end: e.end,
                    eventType: e.eventType
                })),
                message: isOoo ? "Gerrit display name updated to OOO status." : "Gerrit display name updated to normal status."
            }
        };

    } catch (error) {
        context.log.error(error.message);
        context.res = {
            status: 500,
            headers: {
                'Content-Type': 'application/json'
            },
            body: {
                success: false,
                error: error.message
            }
        };
    }
};
