"use client";

import React, { useState, useEffect } from "react";
import TopBar from "@/components/top-bar";
import ChecklistAndConfig from "@/components/checklist-and-config";
import SessionConfigurationPanel from "@/components/session-configuration-panel";
import Transcript from "@/components/transcript";
import FunctionCallsPanel from "@/components/function-calls-panel";
import { Item } from "@/components/types";
import handleRealtimeEvent from "@/lib/handle-realtime-event";
import PhoneNumberChecklist from "@/components/phone-number-checklist";

// Google Calendar API constants - consider moving to .env
const GOOGLE_CLIENT_ID = '877100411075-gai2u5h7ijbchn1qtl7m4acl2kparern.apps.googleusercontent.com';
const GOOGLE_API_KEY = 'AIzaSyDGPC6Gi-ZL0PBKqcvJ0sOuaXflqqkkWp4'; // Ensure this key is appropriately secured
const GOOGLE_DISCOVERY_DOC = 'https://www.googleapis.com/discovery/v1/apis/calendar/v3/rest';
const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar'; // Scope for reading and writing events

// Extend Window interface for Google API callbacks
declare global {
  interface Window {
    gapiLoaded?: () => void;
    gisLoaded?: () => void;
    google?: any; // For google.accounts.oauth2
    gapi?: any; // For gapi.client
  }
}

const CallInterface = () => {
  const [selectedPhoneNumber, setSelectedPhoneNumber] = useState("");
  const [allConfigsReady, setAllConfigsReady] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [callStatus, setCallStatus] = useState("disconnected");
  const [ws, setWs] = useState<WebSocket | null>(null);

  // Google Auth State
  const [gapiInited, setGapiInited] = useState(false);
  const [gisInited, setGisInited] = useState(false);
  const [googleTokenClient, setGoogleTokenClient] = useState<any>(null);
  const [isGoogleAuthReady, setIsGoogleAuthReady] = useState(false);
  const [isGoogleSignedIn, setIsGoogleSignedIn] = useState(false);
  const [googleAccessToken, setGoogleAccessToken] = useState<string | null>(null);

  useEffect(() => {
    if (allConfigsReady && !ws) {
      const newWs = new WebSocket("ws://localhost:8081/logs");

      newWs.onopen = () => {
        console.log("Connected to logs websocket");
        setCallStatus("connected");
      };

      newWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log("Received logs event:", data);
        handleRealtimeEvent(data, setItems);
      };

      newWs.onclose = () => {
        console.log("Logs websocket disconnected");
        setWs(null);
        setCallStatus("disconnected");
      };

      setWs(newWs);
    }
  }, [allConfigsReady, ws]);

  // Effect for Google API script loading and initialization
  useEffect(() => {
    window.gapiLoaded = () => {
      window.gapi.load('client', async () => {
        try {
          await window.gapi.client.init({
            apiKey: GOOGLE_API_KEY,
            discoveryDocs: [GOOGLE_DISCOVERY_DOC],
          });
          setGapiInited(true);
        } catch (error) {
          console.error("Error initializing gapi client:", error);
        }
      });
    };

    window.gisLoaded = () => {
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: GOOGLE_SCOPES,
        callback: (tokenResponse: any) => { // This callback is set dynamically in handleGoogleAuthClick
          if (tokenResponse && tokenResponse.access_token) {
            setIsGoogleSignedIn(true);
            setGoogleAccessToken(tokenResponse.access_token);
            // Send token to backend
            if (ws && ws.readyState === WebSocket.OPEN) {
              const tokenUpdateEvent = {
                type: "google.token.update",
                token: tokenResponse.access_token,
              };
              console.log("Sending Google token to backend:", tokenUpdateEvent);
              ws.send(JSON.stringify(tokenUpdateEvent));
            }
          }
          if (tokenResponse.error) {
            console.error('Google Auth Error:', tokenResponse.error);
            // Potentially handle error state here
          }
        },
      });
      setGoogleTokenClient(tokenClient);
      setGisInited(true);
    };

    const gapiScript = document.createElement('script');
    gapiScript.src = "https://apis.google.com/js/api.js";
    gapiScript.async = true;
    gapiScript.defer = true;
    gapiScript.onload = () => window.gapiLoaded && window.gapiLoaded();
    document.body.appendChild(gapiScript);

    const gisScript = document.createElement('script');
    gisScript.src = "https://accounts.google.com/gsi/client";
    gisScript.async = true;
    gisScript.defer = true;
    gisScript.onload = () => window.gisLoaded && window.gisLoaded();
    document.body.appendChild(gisScript);

    return () => {
      // Cleanup scripts and global functions
      document.body.removeChild(gapiScript);
      document.body.removeChild(gisScript);
      delete window.gapiLoaded;
      delete window.gisLoaded;
    };
  }, [ws]); // Add ws to dependency array to resend token if ws reconnects

  useEffect(() => {
    if (gapiInited && gisInited) {
      setIsGoogleAuthReady(true);
      // Check if user was already signed in
      const token = window.gapi?.client.getToken();
      if (token) {
          setIsGoogleSignedIn(true);
          setGoogleAccessToken(token.access_token);
          // Optionally resend token if ws is available
           if (ws && ws.readyState === WebSocket.OPEN && token.access_token) {
              const tokenUpdateEvent = {
                type: "google.token.update",
                token: token.access_token,
              };
              ws.send(JSON.stringify(tokenUpdateEvent));
            }
      }
    }
  }, [gapiInited, gisInited, ws]);

  const handleGoogleAuthClick = () => {
    if (!googleTokenClient) {
      console.error("Google Token Client not initialized.");
      return;
    }
    if (window.gapi?.client.getToken() === null) {
      // Prompt the user to select a Google Account and ask for consent to share their data
      // when establishing a new session.
      googleTokenClient.requestAccessToken({ prompt: 'consent' });
    } else {
      // Skip display of account chooser and consent dialog for an existing session.
      googleTokenClient.requestAccessToken({ prompt: '' }); // To refresh token
    }
  };

  const handleGoogleSignoutClick = () => {
    const token = window.gapi?.client.getToken();
    if (token !== null) {
      window.google.accounts.oauth2.revoke(token.access_token, () => {
        window.gapi.client.setToken('');
        setIsGoogleSignedIn(false);
        setGoogleAccessToken(null);
        console.log("Google signed out");
        // Optionally notify backend that token is revoked
        if (ws && ws.readyState === WebSocket.OPEN) {
          const tokenRevokeEvent = {
            type: "google.token.revoke",
          };
          ws.send(JSON.stringify(tokenRevokeEvent));
        }
      });
    }
  };

  return (
    <div className="h-screen bg-white flex flex-col">
      <ChecklistAndConfig
        ready={allConfigsReady}
        setReady={setAllConfigsReady}
        selectedPhoneNumber={selectedPhoneNumber}
        setSelectedPhoneNumber={setSelectedPhoneNumber}
      />
      <TopBar />
      <div className="flex-grow p-4 h-full overflow-hidden flex flex-col">
        <div className="grid grid-cols-12 gap-4 h-full">
          {/* Left Column */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <SessionConfigurationPanel
              callStatus={callStatus}
              onSave={(config) => {
                if (ws && ws.readyState === WebSocket.OPEN) {
                  const updateEvent = {
                    type: "session.update",
                    session: {
                      ...config,
                    },
                  };
                  console.log("Sending update event:", updateEvent);
                  ws.send(JSON.stringify(updateEvent));
                }
              }}
            />
            {/* Google Auth Buttons */}
            <div className="mt-4 p-4 border rounded-md bg-gray-50">
              <h3 className="text-lg font-semibold mb-2">Google Calendar</h3>
              {!isGoogleAuthReady && <p>Loading Google Auth...</p>}
              {isGoogleAuthReady && !isGoogleSignedIn && (
                <button
                  onClick={handleGoogleAuthClick}
                  className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                >
                  Authorize Google Calendar
                </button>
              )}
              {isGoogleAuthReady && isGoogleSignedIn && (
                <>
                  <p className="text-green-600 mb-2">Google Calendar Authorized.</p>
                  <button
                    onClick={handleGoogleAuthClick} // Can be used to refresh token
                    className="w-full mb-2 bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Refresh Token
                  </button>
                  <button
                    onClick={handleGoogleSignoutClick}
                    className="w-full bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                  >
                    Sign Out Google Calendar
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Middle Column: Transcript */}
          <div className="col-span-6 flex flex-col gap-4 h-full overflow-hidden">
            <PhoneNumberChecklist
              selectedPhoneNumber={selectedPhoneNumber}
              allConfigsReady={allConfigsReady}
              setAllConfigsReady={setAllConfigsReady}
            />
            <Transcript items={items} />
          </div>

          {/* Right Column: Function Calls */}
          <div className="col-span-3 flex flex-col h-full overflow-hidden">
            <FunctionCallsPanel items={items} ws={ws} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallInterface;
