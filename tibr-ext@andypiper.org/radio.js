// Copyright 2025 Andy Piper.
// SPDX-License-Identifier: GPL-3.0-only

import Gst from 'gi://Gst';
import GObject from 'gi://GObject';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import { AzuraCastAPI } from './api.js';
import {
  USER_AGENT, CLIENT_NAME,
  DEFAULT_VOLUME,
  METADATA_UPDATE_INTERVAL
} from './constants.js';

export const ControlButtons = GObject.registerClass(
  {
    GTypeName: 'ControlButtons',
  },
  class ControlButtons extends St.BoxLayout {
    _init(player, pr) {
      super._init({
        vertical: false,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style: 'padding: 12px 0;'
      });

      this.icon = new St.Icon({
        style_class: 'icon',
        icon_name: 'media-playback-start-symbolic',
        reactive: true,
        icon_size: 32,
      });

      this.add_child(this.icon);

      this.player = player;
      this.playing = false;
      this.pr = pr;

      this.icon.connect('button-press-event', this._onPlayPausePressed.bind(this));
    }

    _onPlayPausePressed() {
      if (this.playing) {
        this.player.stop();
        this.icon.set_icon_name('media-playback-start-symbolic');
        this.pr.setLoading(false);
      } else {
        this.player.play();
        this.icon.set_icon_name('media-playback-stop-symbolic');
        this.pr.setLoading(true);
        if (this.pr.err != null) {
          this.pr.err.destroy();
        }
      }

      this.playing = !this.playing;
    }
  }
);

export class RadioPlayer {
  constructor() {
    this._init();
  }

  _init() {
    Gst.init(null);
    this.playbin = Gst.ElementFactory.make('playbin', 'tibr');
    this.sink = Gst.ElementFactory.make('pulsesink', 'sink');
    this.api = new AzuraCastAPI();

    this.sink.set_property('client-name', CLIENT_NAME);
    this.playbin.set_property('audio-sink', this.sink);
    this.channel = null;
    this.setVolume(DEFAULT_VOLUME);
    this.playing = false;

    // Setup message handling
    let bus = this.playbin.get_bus();
    bus.add_signal_watch();
    bus.connect('message', (bus, msg) => {
      if (msg != null) {
        this._onMessageReceived(msg);
      }
    });

    this.onError = null;
    this.onMetadataChanged = null;
    this._metadataInterval = null;

    // Initialize first available channel
    this._initializeFirstChannel();
  }

  async _initializeFirstChannel() {
    try {
      const channels = await this.api.getChannels();
      if (channels.length > 0) {
        this.channel = channels[0];
        this.playbin.set_property('uri', this.channel.getLink());

        // Start metadata updates if playing
        if (this.playing) {
          this._startMetadataUpdates();
        }
      }
    } catch (error) {
      console.error('TIBR: Error initializing first channel:', error);
    }
  }

  async _updateMetadata() {
    if (!this.channel || !this.playing) return;

    try {
      const nowPlaying = await this.api.getNowPlaying(this.channel.shortcode);
      if (nowPlaying && this.onMetadataChanged) {
        const trackInfo = this.api.parseTrackInfo(nowPlaying);
        this.onMetadataChanged(trackInfo);
      }
    } catch (error) {
      console.error('TIBR: Error updating metadata:', error);
    }
  }

  _startMetadataUpdates() {
    this._stopMetadataUpdates();
    this._updateMetadata(); // Initial update
    this._metadataInterval = setInterval(() => {
      this._updateMetadata();
    }, METADATA_UPDATE_INTERVAL);
  }

  _stopMetadataUpdates() {
    if (this._metadataInterval) {
      clearInterval(this._metadataInterval);
      this._metadataInterval = null;
    }
  }

  play() {
    if (!this.channel) return;

    this.playbin.set_state(Gst.State.PLAYING);
    this.playing = true;
    this._startMetadataUpdates();
  }

  setOnError(onError) {
    this.onError = onError;
  }

  setOnMetadataChanged(onMetadataChanged) {
    this.onMetadataChanged = onMetadataChanged;
  }

  setMute(mute) {
    this.playbin.set_property('mute', mute);
  }

  stop() {
    this.playbin.set_state(Gst.State.NULL);
    this.playing = false;
    this._stopMetadataUpdates();
  }

  setChannel(ch) {
    this.stop();
    this.channel = ch;
    this.playbin.set_state(Gst.State.NULL);

    const baseUrl = ch.getLink();
    const separator = baseUrl.includes('?') ? '&' : '?';
    const urlWithUA = `${baseUrl}${separator}ua=${encodeURIComponent(USER_AGENT)}`;

    this.playbin.set_property('uri', urlWithUA);
  }

  getChannel() {
    return this.channel;
  }

  setVolume(value) {
    this.playbin.volume = value;
  }

  isPlaying() {
    return this.playing;
  }

  cleanup() {
    this.stop();
    this._stopMetadataUpdates();
    if (this.api) {
      this.api.destroy();
      this.api = null;
    }
  }

  _onMessageReceived(msg) {
    switch (msg.type) {
      case Gst.MessageType.STREAM_START:
        // Stream started
        if (this.onMetadataChanged) {
          this._updateMetadata();
        }
        break;
      // TODO: additional Gst checks
      case Gst.MessageType.CLOCK_LOST:
        console.debug('TIBR: Clock lost, restarting playback');
        this.playbin.set_state(Gst.State.PAUSED);
        this.playbin.set_state(Gst.State.PLAYING);
        break;
      case Gst.MessageType.LATENCY:
        console.debug('TIBR: Latency changed, recalculating');
        this.playbin.recalculate_latency();
        break;
      case Gst.MessageType.BUFFERING:
        let percent = msg.parse_buffering();
        console.debug(`TIBR: Buffering ${percent}%`);
        // attempt to pause and resume on buffering
        if (percent < 100) {
          this.playbin.set_state(Gst.State.PAUSED);
        } else if (this.playing) {
          this.playbin.set_state(Gst.State.PLAYING);
        }
        break;
      case Gst.MessageType.EOS:
      case Gst.MessageType.ERROR:
        // this was unexpected
        let [error, debug] = msg.parse_error();
        console.error(`TIBR: GStreamer Error - ${error.message}. Debug Info: ${debug}`);
        this.stop();
        if (this.pr) {
          this.pr.showErrorNotification(`Playback Error: ${error.message}`);
        }
        if (this.onError) {
          this.onError();
        }
        break;
    }
  }
}
