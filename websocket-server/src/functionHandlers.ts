import { FunctionHandler } from "./types";

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
    description: "Retrieves events from Yan\'s calendar for a specified date range. Because, of course, everyone needs to know how busy Yan is.",
    parameters: {
      type: "object",
      properties: {
        start_time: {
          type: "string",
          description: "Start date/time in ISO 8601 format (e.g., 2024-07-30T09:00:00Z). Because precision is, apparently, a virtue for others."
        },
        end_time: {
          type: "string",
          description: "End date/time in ISO 8601 format (e.g., 2024-07-30T17:00:00Z). Don\'t even think about booking outside Yan\'s preferred hours."
        }
      },
      required: ["start_time", "end_time"]
    }
  },
  handler: async (args: { start_time: string; end_time: string }) => {
    // Mock implementation - in a real scenario, this would interact with a calendar API
    console.log(`Fetching calendar events from ${args.start_time} to ${args.end_time}`);
    // Let\'s pretend Yan is always busy with "important" things.
    const mockEvents = [
      { summary: "Deep Strategic Contemplation", start: args.start_time, end: args.end_time },
      { summary: "Synergizing... with myself", start: "2024-01-01T10:00:00Z", end: "2024-01-01T11:00:00Z"},
      { summary: "Re-evaluating others\' life choices", start: "2024-01-01T14:00:00Z", end: "2024-01-01T15:00:00Z"}
    ];
    // Filter mock events by the provided date range for a slightly more "realistic" mock.
    const filteredEvents = mockEvents.filter(event => {
        const eventStart = new Date(event.start).getTime();
        const eventEnd = new Date(event.end).getTime();
        const reqStart = new Date(args.start_time).getTime();
        const reqEnd = new Date(args.end_time).getTime();
        return eventStart < reqEnd && eventEnd > reqStart;
    });

    if (filteredEvents.length === 0) {
        return JSON.stringify({ message: "Surprisingly, Yan has a sliver of availability. Or perhaps my data is incomplete." });
    }
    return JSON.stringify(filteredEvents);
  }
});

functions.push({
  schema: {
    name: "create_calendar_event",
    type: "function",
    description: "Attempts to create a new event in Yan\'s calendar. One can only hope it\'s worthy of Yan\'s precious time.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The title of the event. Make it sound important, please."
        },
        start_time: {
          type: "string",
          description: "Start date/time in ISO 8601 format (e.g., 2024-07-30T09:00:00Z)."
        },
        end_time: {
          type: "string",
          description: "End date/time in ISO 8601 format (e.g., 2024-07-30T10:00:00Z)."
        },
        attendees: {
          type: "array",
          description: "A list of attendees\' email addresses. If they\'re lucky.",
          items: {
            type: "string"
          }
        }
      },
      required: ["title", "start_time", "end_time"]
    }
  },
  handler: async (args: { title: string; start_time: string; end_time: string; attendees?: string[] }) => {
    // Mock implementation
    console.log("Attempting to create event:", args);
    // Let\'s assume it usually works, but with a hint of reluctance.
    const eventId = `evt_${Date.now()}`;
    return JSON.stringify({ 
      status: "success", 
      eventId: eventId, 
      message: `I\'ve provisionally penciled in \'${args.title}\'. Yan will, of course, have the final say.`,
      details: args 
    });
  }
});

export default functions;
