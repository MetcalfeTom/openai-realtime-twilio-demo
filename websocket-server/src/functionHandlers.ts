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
        `https://serpapi.com/search.json?q=${searchQuery}&api_key=YOUR_SERP_API_KEY`,
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

export default functions;
