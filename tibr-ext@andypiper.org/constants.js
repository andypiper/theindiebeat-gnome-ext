// Copyright 2025 Andy Piper.
// SPDX-License-Identifier: GPL-3.0-only

export const DEFAULT_VOLUME = 0.5; // TODO: make this configurable?

// naming and versioning
export const APP_NAME = 'TheIndieBeat-GNOME';
export const APP_VERSION = '1.0-dev'; // update for each release
export const USER_AGENT = `${APP_NAME}/${APP_VERSION}`;
export const CLIENT_NAME = 'tibr-radio';
export const API_BASE_URL = 'https://azura.theindiebeat.fm/api';

// cache durations
export const CHANNEL_CACHE_DURATION = 5 * 60 * 1000;  // 5 minutes for channel list
export const METADATA_CACHE_DURATION = 30 * 1000;     // 30 seconds for API refresh track metadata
export const REQUEST_DEBOUNCE_TIME = 1000;            // 1 second
export const CLEANUP_INTERVAL = 60 * 1000;            // 1 minute
export const METADATA_UPDATE_INTERVAL = 30 * 1000;    // 30 seconds for player refresh

export const INACTIVE_RESET_TIMEOUT = 10 * 60 * 1000; // 10 minutes
