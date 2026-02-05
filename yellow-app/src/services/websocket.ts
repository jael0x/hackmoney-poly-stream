/**
 * WebSocket Service for Yellow Network Communication
 * Handles connection management, message queuing, and automatic reconnection
 */

import { EventEmitter } from 'events';

/**
 * WebSocket message types for Yellow Network protocol
 */
export type MessageType =
  | 'auth_request'
  | 'auth_challenge'
  | 'auth_verify'
  | 'auth_success'
  | 'create_channel'
  | 'resize_channel'
  | 'close_channel'
  | 'get_config'
  | 'error';

/**
 * Yellow Network WebSocket message structure
 */
export interface YellowMessage {
  req?: [number, string, any, number]; // [version, method, params, timestamp]
  res?: [number, string, any];         // [version, method, result]
  sig?: string[];                       // Signatures array
}

/**
 * WebSocket Manager class
 * Manages WebSocket connection to Yellow Network with automatic reconnection
 */
export class WebSocketManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private messageQueue: YellowMessage[] = [];
  private isConnecting = false;

  constructor(url: string) {
    super();
    this.url = url;
  }

  /**
   * Connect to Yellow Network WebSocket
   * @returns Promise that resolves when connected
   */
  async connect(): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[WS] Already connected');
      return;
    }

    if (this.isConnecting) {
      console.log('[WS] Connection already in progress');
      return;
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        console.log('[WS] Connecting to:', this.url);
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log('[WS] Connected successfully');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.reconnectDelay = 1000;

          // Send any queued messages
          this.flushMessageQueue();

          this.emit('connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[WS] Message received:', data);

            // Parse message type from response
            const messageType = this.parseMessageType(data);

            // Emit typed events for different message types
            this.emit('message', data);
            if (messageType) {
              console.log(`[WS] Emitting event: ${messageType}, listeners:`, this.listenerCount(messageType));
              this.emit(messageType, data);
            }
          } catch (error) {
            console.error('[WS] Error parsing message:', error);
            this.emit('error', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[WS] WebSocket error:', error);
          this.isConnecting = false;
          this.emit('error', error);
          reject(error);
        };

        this.ws.onclose = (event) => {
          console.log('[WS] Connection closed:', event.code, event.reason);
          this.isConnecting = false;
          this.ws = null;

          this.emit('disconnected', event);

          // Attempt to reconnect if not manually closed
          if (event.code !== 1000) {
            this.attemptReconnect();
          }
        };

      } catch (error) {
        console.error('[WS] Connection error:', error);
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Send a message to Yellow Network
   * @param message - Message to send
   * @param queueIfDisconnected - Whether to queue the message if disconnected
   */
  send(message: YellowMessage, queueIfDisconnected = true): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      const data = JSON.stringify(message);
      console.log('[WS] Sending message:', message);
      this.ws.send(data);
    } else if (queueIfDisconnected) {
      console.log('[WS] Queueing message (not connected):', message);
      this.messageQueue.push(message);

      // Try to connect if not already
      if (!this.isConnecting) {
        this.connect();
      }
    } else {
      console.error('[WS] Cannot send message - not connected');
      throw new Error('WebSocket is not connected');
    }
  }

  /**
   * Send a request and wait for response
   * @param method - Method name
   * @param params - Method parameters
   * @param signature - Optional signature
   * @returns Promise with response
   */
  async request(
    method: string,
    params: any,
    signature?: string[]
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timestamp = Date.now();
      const message: YellowMessage = {
        req: [1, method, params, timestamp],
        sig: signature || []
      };

      // Set up one-time listener for the response
      const responseHandler = (data: YellowMessage) => {
        if (data.res && data.res[1] === method) {
          this.removeListener('message', responseHandler);

          // Check for errors
          if (data.res[0] === 0) {
            reject(new Error(data.res[2]));
          } else {
            resolve(data.res[2]);
          }
        }
      };

      this.on('message', responseHandler);

      // Send the request
      this.send(message);

      // Timeout after 30 seconds
      setTimeout(() => {
        this.removeListener('message', responseHandler);
        reject(new Error(`Request timeout: ${method}`));
      }, 30000);
    });
  }

  /**
   * Disconnect from Yellow Network
   */
  disconnect(): void {
    console.log('[WS] Disconnecting...');
    this.reconnectAttempts = this.maxReconnectAttempts; // Prevent reconnection

    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }

    this.messageQueue = [];
    this.removeAllListeners();
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Parse message type from Yellow Network response
   * @private
   */
  private parseMessageType(data: YellowMessage): MessageType | null {
    if (data.res) {
      const method = data.res[1];

      // Log the message parsing for debugging
      console.log(`[WS] Parsing message type for method: ${method}, status: ${data.res[0]}`);

      // Special case: 'error' method indicates an error response
      if (method === 'error') {
        console.log('[WS] Error response detected:', data.res[2]);
        return 'error';
      }

      switch (method) {
        case 'auth_request':
          // Check if it's an auth_challenge response (special case)
          if (data.res[0] === 1 && data.res[2]?.challenge_message) {
            console.log('[WS] Detected auth_challenge in auth_request response');
            return 'auth_challenge';
          }
          return 'auth_request';
        case 'auth_challenge':
          return 'auth_challenge';
        case 'auth_verify':
          // When auth_verify succeeds (res[0] === 1), emit as auth_success
          if (data.res[0] === 1) {
            console.log('[WS] Auth verify successful, emitting auth_success');
            return 'auth_success';
          }
          console.log('[WS] Auth verify failed or pending');
          return 'auth_verify';
        case 'create_channel':
          return 'create_channel';
        case 'resize_channel':
          return 'resize_channel';
        case 'close_channel':
          return 'close_channel';
        case 'get_config':
          return 'get_config';
        case 'get_assets':
          return 'get_config'; // Reuse get_config type
        // Server push notifications - NOT errors
        case 'bu': // balance update
        case 'assets':
        case 'channels':
        case 'cu': // channel update
        case 'ping':
        case 'pong':
        case 'tr': // transfer notification
        case 'asu': // app session update
          console.log(`[WS] Server notification: ${method}`);
          return null; // Ignore notifications, don't treat as errors
        default:
          // Only treat as error if status is 0 AND it's not a notification
          if (data.res[0] === 0 && data.res[2]?.error) {
            return 'error';
          }
          return null;
      }
    }

    return null;
  }

  /**
   * Flush queued messages after reconnection
   * @private
   */
  private flushMessageQueue(): void {
    console.log(`[WS] Flushing ${this.messageQueue.length} queued messages`);

    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      if (message) {
        this.send(message, false);
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   * @private
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[WS] Max reconnection attempts reached');
      this.emit('reconnectFailed');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`[WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

    setTimeout(() => {
      this.connect().catch((error) => {
        console.error('[WS] Reconnection failed:', error);
      });
    }, delay);
  }
}

// Export singleton instance
let wsManager: WebSocketManager | null = null;

/**
 * Get or create WebSocket manager instance
 * @param url - WebSocket URL (required on first call)
 * @returns WebSocket manager instance
 */
export function getWebSocketManager(url?: string): WebSocketManager {
  if (!wsManager) {
    if (!url) {
      throw new Error('WebSocket URL is required for first initialization');
    }
    wsManager = new WebSocketManager(url);
  }

  return wsManager;
}