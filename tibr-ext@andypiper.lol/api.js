// Copyright 2025 Andy Piper.
// SPDX-License-Identifier: GPL-3.0-only

import Soup from 'gi://Soup?version=3.0';
import GLib from 'gi://GLib';

const BASE_URL = 'https://azura.theindiebeat.fm/api';
const CACHE_DURATION = 5 * 60 * 1000;           // 5 minutes for channel list
const METADATA_CACHE_DURATION = 30 * 1000;      // 30 seconds for track metadata
const REQUEST_DEBOUNCE_TIME = 1000;             // 1 second

export class Channel {
  constructor(data) {
    this.id = data.id;
    this.name = data.name;
    this.shortcode = data.shortcode;
    this.url = data.url;
    this.listenUrl = data.listen_url;
    this.mounts = data.mounts || [];
    this.art = data.art || null;
  }

  getName() {
    return this.name;
  }

  getLink() {
    // Return the primary mount point URL if available, otherwise use listen_url
    if (this.mounts.length > 0) {
      const defaultMount = this.mounts.find(m => m.is_default);
      if (defaultMount) {
        return defaultMount.url;
      }
      return this.mounts[0].url;
    }
    return this.listenUrl;
  }

  getPic() {
    return "/images/catellite.png"; // Default image path
  }
}

export class AzuraCastAPI {
  constructor() {
    // Initialize Soup session with optimized settings
    this._session = new Soup.Session();
    this._session.timeout = 10;
    this._session.max_conns = 4;
    this._session.max_conns_per_host = 2;

    // Cache management
    this._channels = [];
    this._lastFetch = 0;
    this._fetchPromise = null;
    this._metadataCache = new Map();
    this._pendingRequests = new Map();

    // Start periodic cache cleanup
    this._setupCacheCleanup();
  }

  async getChannels() {
    // Check cache first
    const now = Date.now();
    if (this._channels.length > 0 && (now - this._lastFetch < CACHE_DURATION)) {
      return this._channels;
    }

    // If a fetch is already in progress, wait for it
    if (this._fetchPromise) {
      return this._fetchPromise;
    }

    this._fetchPromise = this._fetchChannels();
    try {
      const channels = await this._fetchPromise;
      this._channels = channels;
      this._lastFetch = now;
      return channels;
    } finally {
      this._fetchPromise = null;
    }
  }

  async getNowPlaying(stationId) {
    // Check metadata cache first
    const now = Date.now();
    const cached = this._metadataCache.get(stationId);
    if (cached && (now - cached.timestamp < METADATA_CACHE_DURATION)) {
      return cached.data;
    }

    try {
      const response = await this._makeRequest(`/nowplaying/${stationId}`);
      const data = JSON.parse(response);

      // Update cache
      this._metadataCache.set(stationId, {
        data,
        timestamp: now
      });

      return data;
    } catch (error) {
      console.error('TIBR: Error fetching now playing:', error);
      return null;
    }
  }

  parseTrackInfo(nowPlaying) {
    if (!nowPlaying || !nowPlaying.now_playing) {
      return {
        title: 'Unknown',
        artist: 'Unknown',
        album: 'Unknown',
        artwork: null,
        externalLink: null
      };
    }

    const track = nowPlaying.now_playing.song;
    return {
      title: track.title || 'Unknown',
      artist: track.artist || 'Unknown',
      album: track.album || 'Unknown',
      artwork: track.art || null,
      externalLink: track.custom_fields?.ext_links || null
    };
  }

  async prefetchChannels() {
    try {
      const channels = await this.getChannels();
      // Prefetch first channel's metadata
      if (channels.length > 0) {
        await this.getNowPlaying(channels[0].shortcode);
      }
    } catch (error) {
      console.error('TIBR: Error prefetching data:', error);
    }
  }

  clearCaches() {
    this._channels = [];
    this._lastFetch = 0;
    this._metadataCache.clear();
    this._pendingRequests.clear();
  }

  async _fetchChannels() {
    try {
      const response = await this._makeRequest('/stations');
      const stations = JSON.parse(response);
      return stations.map(station => new Channel(station));
    } catch (error) {
      console.error('TIBR: Error fetching channels:', error);
      return [];
    }
  }

  _makeRequest(endpoint) {
    // Check for pending request for this endpoint
    const pending = this._pendingRequests.get(endpoint);
    if (pending) {
      return pending;
    }

    const request = new Promise((resolve, reject) => {
      const message = Soup.Message.new('GET', BASE_URL + endpoint);

      this._session.send_and_read_async(
        message,
        GLib.PRIORITY_DEFAULT,
        null,
        (session, result) => {
          try {
            const bytes = session.send_and_read_finish(result);
            if (message.get_status() !== Soup.Status.OK) {
              reject(new Error(`HTTP Error: ${message.get_status()}`));
              return;
            }

            const decoder = new TextDecoder('utf-8');
            const response = decoder.decode(bytes.get_data());
            resolve(response);
          } catch (error) {
            reject(error);
          } finally {
            // Clear the pending request after debounce time
            setTimeout(() => {
              this._pendingRequests.delete(endpoint);
            }, REQUEST_DEBOUNCE_TIME);
          }
        }
      );
    });

    // Store the pending request
    this._pendingRequests.set(endpoint, request);
    return request;
  }

  _setupCacheCleanup() {
    const CLEANUP_INTERVAL = 60000; // Run cleanup every minute
    setInterval(() => {
      const now = Date.now();

      // Cleanup metadata cache
      for (const [stationId, entry] of this._metadataCache.entries()) {
        if (now - entry.timestamp > METADATA_CACHE_DURATION) {
          this._metadataCache.delete(stationId);
        }
      }

      // Cleanup pending requests
      for (const [endpoint, promise] of this._pendingRequests.entries()) {
        // If a request has been pending too long, remove it
        if (now - promise.timestamp > REQUEST_DEBOUNCE_TIME * 2) {
          this._pendingRequests.delete(endpoint);
        }
      }
    }, CLEANUP_INTERVAL);
  }
}
