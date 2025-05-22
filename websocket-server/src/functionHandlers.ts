import { FunctionHandler } from "./types";
import { google, Auth, calendar_v3 } from 'googleapis';

// This is a placeholder for where your WebSocket server would store the token.
// In a real app, you would manage this more securely and typically on a per-user/session basis.
// For example, in your main WebSocket server file (e.g., index.ts), you might have:
// let googleAccessToken: string | null = null;
// And a message handler:
// ws.on('message', (message) => {
//   const data = JSON.parse(message.toString());
//   if (data.type === 'google.token.update') {
//     googleAccessToken = data.token;
//     console.log('Google Access Token updated on backend.');
//   } else if (data.type === 'google.token.revoke') {
//     googleAccessToken = null;
//     console.log('Google Access Token revoked on backend.');
//   }
//   // ... other message handling
// });
// For this file to access it, you might need to export/import it or pass it around.
// For simplicity here, we'll assume it's accessible via a global or a shared module.
// THIS IS A SIMPLIFIED APPROACH FOR DEMONSTRATION.
let googleAccessToken: string | null = null; // Simulated storage
// You MUST ensure this variable is updated by your WebSocket server logic.
// A better way would be to pass the token into the handler functions if possible,
// or retrieve it from a shared, authenticated session context.

// Function to update the token (call this from your WebSocket message handler)
export const setGoogleAccessToken = (token: string | null) => {
  googleAccessToken = token;
  if (token) {
    console.log("Backend Google Access Token UPDATED.");
  } else {
    console.log("Backend Google Access Token REVOKED.");
  }
};

// Helper to get an OAuth2 client
function getGoogleAuthClient(): Auth.OAuth2Client | null {
  if (!googleAccessToken) {
    console.error("Google Access Token is not available.");
    return null;
  }
  const oauth2Client = new google.auth.OAuth2();
  oauth2Client.setCredentials({ access_token: googleAccessToken });
  return oauth2Client;
}

const functions: FunctionHandler[] = [];

functions.push({
  schema: {
    name: "get_weather_from_coords",
    type: "function",
    description: "Get the current weather",
    parameters: {
      type: "object",
      properties: {
        latitude: {
          type: "number",
        },
        longitude: {
          type: "number",
        },
      },
      required: ["latitude", "longitude"],
    },
  },
  handler: async (args: { latitude: number; longitude: number }) => {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${args.latitude}&longitude=${args.longitude}&current=temperature_2m,wind_speed_10m&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m`
    );
    const data = await response.json();
    const currentTemp = data.current?.temperature_2m;
    return JSON.stringify({ temp: currentTemp });
  },
});

functions.push({
  schema: {
    name: "find_person_info",
    type: "function",
    description: "Search for information about a person given their name and company",
    parameters: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Full name of the person to search for"
        },
        company: {
          type: "string",
          description: "Company name the person is associated with"
        }
      },
      required: ["name"]
    }
  },
  handler: async (args: { name: string; company?: string }) => {
    try {
      // Construct search query with name and company if provided
      const searchQuery = args.company 
        ? `${encodeURIComponent(args.name)} ${encodeURIComponent(args.company)}`
        : encodeURIComponent(args.name);
      
      // Use a search API - this example uses a free API service
      const response = await fetch(
        `https://serpapi.com/search.json?q=${searchQuery}&api_key=${process.env.SERP_API_KEY}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      
      // If you don't have a SERP API key, you can use a simpler implementation:
      // This is a fallback that returns some basic information
      if (!response.ok) {
        return JSON.stringify({
          message: "Could not retrieve detailed information. This is a demo response.",
          searchQuery: `${args.name}${args.company ? ` at ${args.company}` : ''}`,
          possibleInfo: {
            name: args.name,
            company: args.company || "Unknown",
            note: "This is simulated data. For real implementation, use a proper search API with an API key."
          }
        });
      }
      
      const data = await response.json();
      return JSON.stringify({
        searchResults: data.organic_results?.slice(0, 3) || [],
        knowledgeGraph: data.knowledge_graph || null,
        searchQuery: searchQuery
      });
    } catch (error) {
      return JSON.stringify({
        error: "Error searching for person information",
        message: error instanceof Error ? error.message : "Unknown error",
        searchQuery: `${args.name}${args.company ? ` at ${args.company}` : ''}`
      });
    }
  }
});

functions.push({
  schema: {
    name: "get_calendar_events",
    type: "function",
    description: "Retrieves events from the primary Google calendar for a specified date range.",
    parameters: {
      type: "object",
      properties: {
        start_time: {
          type: "string",
          description: "Start date/time in ISO 8601 format (e.g., 2024-07-30T09:00:00Z)."
        },
        end_time: {
          type: "string",
          description: "End date/time in ISO 8601 format (e.g., 2024-07-30T17:00:00Z)."
        },
        max_results: {
            type: "integer",
            description: "Maximum number of events to return. Defaults to 10."
        }
      },
      required: ["start_time", "end_time"]
    }
  },
  handler: async (args: { start_time: string; end_time: string; max_results?: number }) => {
    const authClient = getGoogleAuthClient();
    if (!authClient) {
      return JSON.stringify({ error: "User not authenticated with Google Calendar. Please authorize via the frontend." });
    }
    const calendar = google.calendar({ version: 'v3', auth: authClient });
    try {
      console.log(`Fetching Google Calendar events from ${args.start_time} to ${args.end_time}`);
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin: args.start_time,
        timeMax: args.end_time,
        maxResults: args.max_results || 10,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = response.data.items;
      if (!events || events.length === 0) {
        return JSON.stringify({ message: "No upcoming events found in Google Calendar for the specified range." });
      }
      return JSON.stringify(events.map(event => ({
        summary: event.summary,
        start: event.start?.dateTime || event.start?.date,
        end: event.end?.dateTime || event.end?.date,
        id: event.id,
        htmlLink: event.htmlLink,
        description: event.description,
        location: event.location,
      })));
    } catch (error: any) {
      console.error('Error fetching Google Calendar events:', error);
      return JSON.stringify({ error: "Error fetching Google Calendar events", message: error.message });
    }
  }
});

functions.push({
  schema: {
    name: "create_calendar_event",
    type: "function",
    description: "Creates a new event in the primary Google Calendar.",
    parameters: {
      type: "object",
      properties: {
        summary: {
          type: "string",
          description: "The title/summary of the event."
        },
        description: {
            type: "string",
            description: "A description of the event."
        },
        location: {
            type: "string",
            description: "The location of the event."
        },
        start_time: {
          type: "string",
          description: "Start date/time in ISO 8601 format (e.g., 2024-07-30T09:00:00-07:00)."
        },
        end_time: {
          type: "string",
          description: "End date/time in ISO 8601 format (e.g., 2024-07-30T10:00:00-07:00)."
        },
        attendees: {
          type: "array",
          description: "A list of attendees' email addresses.",
          // @ts-ignore - OpenAI schema allows this structure for array items
          items: {
            type: "string",
            description: "Email address of an attendee."
          }
        },
        time_zone: {
            type: "string",
            description: "The IANA Time Zone Database name for the event, e.g., 'America/Los_Angeles'. If not specified, the calendar's default timezone will be used."
        }
      },
      required: ["summary", "start_time", "end_time"]
    }
  },
  handler: async (args: {
    summary: string;
    description?: string;
    location?: string;
    start_time: string;
    end_time: string;
    attendees?: string[];
    time_zone?: string;
  }) => {
    const authClient = getGoogleAuthClient();
    if (!authClient) {
      return JSON.stringify({ error: "User not authenticated with Google Calendar. Please authorize via the frontend." });
    }
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    const event: calendar_v3.Schema$Event = {
      summary: args.summary,
      description: args.description,
      location: args.location,
      start: {
        dateTime: args.start_time,
        timeZone: args.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
      end: {
        dateTime: args.end_time,
        timeZone: args.time_zone || Intl.DateTimeFormat().resolvedOptions().timeZone,
      },
    };

    if (args.attendees && args.attendees.length > 0) {
      event.attendees = args.attendees.map(email => ({ email }));
    }

    try {
      console.log("Attempting to create Google Calendar event:", JSON.stringify(event, null, 2));
      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });
      console.log('Event created. Response status:', response.status);
      if (response.data && response.data.htmlLink) {
        console.log('Event created: %s', response.data.htmlLink);
        return JSON.stringify({
          status: "success",
          eventId: response.data.id,
          htmlLink: response.data.htmlLink,
          message: `Event '${args.summary}' created successfully.`,
          details: response.data
        });
      } else {
        console.error('Error creating Google Calendar event: Event created but no htmlLink in response.', response);
        return JSON.stringify({
            error: "Error creating Google Calendar event",
            message: "Event might have been created, but encountered an issue retrieving its details.",
            details: response.data
        });
      }
    } catch (error: any) {
      console.error('Error creating Google Calendar event:', error);
      // Try to parse Google API error
      let errorMessage = error.message;
      if (error.errors && error.errors.length > 0 && error.errors[0].message) {
          errorMessage = error.errors[0].message;
      }
      return JSON.stringify({
        error: "Error creating Google Calendar event",
        message: errorMessage,
        details: args
      });
    }
  }
});

export default functions;
