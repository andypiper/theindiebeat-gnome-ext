// Copyright 2025 Andy Piper.
// SPDX-License-Identifier: GPL-3.0-only

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';

import * as Animation from 'resource:///org/gnome/shell/ui/animation.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import * as Radio from './radio.js';

let player;
let button;
let popup;

export let extPath;

const TIBRPopup = GObject.registerClass(
  {
    GTypeName: 'TIBRPopup',
  },
  class TIBRPopup extends PopupMenu.PopupBaseMenuItem {
    _init(player) {
      super._init({
        hover: false,
        activate: false,
        can_focus: true,
      });

      this.volume = 0.5; // Default volume
      this.old_vol = 0;
      this.player = player;

      this.box = new St.BoxLayout({
        vertical: true,
        width: 250,
      });

      // Volume control section
      this.volBox = new St.BoxLayout({
        vertical: false,
        width: 250,
      });

      this.loadingBox = new St.BoxLayout({
        vertical: false,
        x_align: Clutter.ActorAlign.CENTER,
        style_class: 'tibr-popup-loading-box',
      });

      this.add_child(this.box);

      // Volume slider
      this.slider = new Slider.Slider(this.volume);
      this.slider.connect('notify::value', this._onVolumeChanged.bind(this));

      // Mute icon
      this.mute_icon = new St.Icon({
        icon_name: 'audio-volume-medium-symbolic',
        icon_size: 20,
        reactive: true,
        style_class: 'volume-mute-icon',
      });

      this.mute_icon.connect('button-press-event', () => this.setMute());

      this.volBox.add_child(this.mute_icon);
      this.volBox.add_child(this.slider);
      this.box.add_child(this.volBox);

      this.err = null;
      this.createUi();
    }

    createUi() {
      // Volume control
      this.volBox.style_class = 'volume-box';

      // Loading indicator
      this.spinner = new Animation.Spinner(16);
      this.loadtxt = new St.Label({
        text: 'Loading...',
      });
      this.loadtxt.hide();

      // Control button
      this.controlbtns = new Radio.ControlButtons(this.player, this);
      this.player.setOnError(() => {
        this.setError(false);
        this.setError(true);
      });

      this.box.add_child(this.controlbtns);

      // Track metadata container
      this.metadataBox = new St.BoxLayout({
        vertical: true,
        style_class: 'metadata-box',
      });

      // Track artwork
      this.artwork = new St.Icon({
        gicon: Gio.icon_new_for_string(extPath + '/images/catellite.png'),
        icon_size: 110,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      // Track info labels
      this.trackTitle = new St.Label({
        text: 'Independent music',
        style_class: 'track-title',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      this.artistName = new St.Label({
        text: 'from artists',
        style_class: 'track-artist',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      this.albumName = new St.Label({
        text: 'in the Fediverse',
        style_class: 'track-album',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      // Artist profile link
      this.artistLink = new St.Button({
        style_class: 'artist-link-button',
        label: 'View Artist Page',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        visible: false
      });

      this.artistLink.connect('clicked', () => {
        if (this.currentExternalLink) {
          Gio.app_info_launch_default_for_uri(this.currentExternalLink, null);
        }
      });

      // Add all metadata elements
      this.metadataBox.add_child(this.artwork);
      this.metadataBox.add_child(this.trackTitle);
      this.metadataBox.add_child(this.artistName);
      this.metadataBox.add_child(this.albumName);
      this.metadataBox.add_child(this.artistLink);

      this.box.add_child(this.metadataBox);

      // Current channel indicator
      this.channelLabel = new St.Label({
        text: '',
        style_class: 'current-channel-label',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true
      });
      this.box.add_child(this.channelLabel);

      this.loadingBox.add_child(this.spinner);
      this.loadingBox.add_child(this.loadtxt);
      this.box.add_child(this.loadingBox);

      this.spinner.hide();

      // Set up metadata update handler
      this.player.setOnMetadataChanged(this._onMetadataChanged.bind(this));
    }

    _onMetadataChanged(trackInfo) {
      if (!this.player.isPlaying()) {
        this._showDefaultMetadata();
        return;
      }

      // Update artwork
      if (trackInfo.artwork) {
        this.artwork.set_gicon(Gio.icon_new_for_string(trackInfo.artwork));
      } else {
        this.artwork.set_gicon(Gio.icon_new_for_string(extPath + '/images/catellite.png'));
      }

      // Update text
      this.trackTitle.set_text(trackInfo.title);
      this.artistName.set_text(trackInfo.artist);
      this.albumName.set_text(trackInfo.album);

      // Update artist profile link
      if (trackInfo.externalLink) {
        this.currentExternalLink = trackInfo.externalLink;
        this.artistLink.show();
      } else {
        this.currentExternalLink = null;
        this.artistLink.hide();
      }

      // Hide loading indicators
      this.loadtxt.hide();
      this.setLoading(false);

      // Update channel indicator
      if (this.channelLabel) {
        this.channelLabel.set_text(this.player.getChannel()?.getName() || 'Unknown Channel');
        this.channelLabel.show();
      }
    }

    _showDefaultMetadata() {
      this.artwork.set_gicon(Gio.icon_new_for_string(extPath + '/images/catellite.png'));
      this.trackTitle.set_text('The Indie Beat');
      this.artistName.set_text('');
      this.albumName.set_text('');
      this.artistLink.hide();
      this.currentExternalLink = null;
      this.loadtxt.hide();
    }

    _onVolumeChanged(slider) {
      this.player.setVolume(slider.value);
      this.volume = slider.value;
      this.setVolIcon(slider.value);
    }

    setMute() {
      if (this.volume > 0) {
        this.old_vol = this.volume;
        this.volume = 0;
        this.slider.value = 0;
      } else {
        this.volume = this.old_vol;
        this.slider.value = this.volume;
      }
      this.player.setMute(this.volume == 0);
      this.setVolIcon(this.volume);
    }

    setLoading(state) {
      if (!state) {
        this.loadtxt.hide();
        this.spinner.stop();
        this.spinner.hide();
      } else {
        this.loadtxt.show();
        this.spinner.play();
        this.spinner.show();
      }
    }

    setError(state) {
      if (!state) {
        if (this.err != null) {
          this.err.destroy();
          this.err = null;
        }
        return;
      }
      this.stopped();
      this.err = new St.Label({
        text: '--- Error ---',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });
      this.box.add_child(this.err);
    }

    showErrorNotification(errorMessage) {
      let errorLabel = new St.Label({
        text: errorMessage,
        style_class: 'error-notification',
      });
      this.box.add_child(errorLabel);

      GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        errorLabel.destroy();
        return GLib.SOURCE_REMOVE;
      });
    }

    stopped() {
      this.controlbtns.icon.set_icon_name('media-playback-start-symbolic');
      this.controlbtns.playing = false;
      this.setLoading(false);
      this._showDefaultMetadata();
    }

    channelChanged() {
      this.controlbtns.icon.set_icon_name('media-playback-stop-symbolic');
      this.controlbtns.playing = true;
      this.setLoading(true);
      if (this.channelLabel) {
        this.channelLabel.set_text(this.player.getChannel()?.getName() || 'Unknown Channel');
        this.channelLabel.show();
      }
    }

    setVolIcon(vol) {
      if (vol == 0) {
        this.mute_icon.set_icon_name('audio-volume-muted-symbolic');
      } else if (vol < 0.3) {
        this.mute_icon.set_icon_name('audio-volume-low-symbolic');
      } else if (vol < 0.6) {
        this.mute_icon.set_icon_name('audio-volume-medium-symbolic');
      } else {
        this.mute_icon.set_icon_name('audio-volume-high-symbolic');
      }
    }
  }
);

const ChannelBox = GObject.registerClass(
  class ChannelBox extends PopupMenu.PopupBaseMenuItem {
    _init(channel, player, popup) {
      super._init({
        reactive: true,
        can_focus: true,
      });

      this.player = player;
      this.channel = channel;
      this.popup = popup;

      let label = new St.Label({
        text: channel.getName(),
        y_align: Clutter.ActorAlign.CENTER,
        y_expand: true,
      });

      this.add_child(label);
    }

    activate() {
      this.player.setChannel(this.channel);
      this.player.play();
      this.popup.channelChanged();
    }
  }
);

const TIBRPanelButton = GObject.registerClass(
  {
    GTypeName: 'TIBRPanelButton',
  },
  class TIBRButton extends PanelMenu.Button {
    _init(player) {
      super._init(0.0, 'TIBR');

      let box = new St.BoxLayout({
        style_class: 'panel-status-menu-box',
      });

      let icon = new St.Icon({
        gicon: Gio.icon_new_for_string(extPath + '/images/catellite-icon-mini.svg'),
        style_class: 'system-status-icon',
      });

      box.add_child(icon);
      this.add_child(box);
      this.add_style_class_name('panel-status-button');

      popup = new TIBRPopup(player);
      this.menu.addMenuItem(popup);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // TODO: consider some kind of sharing option

      // TODO: probably make these URLs constants
      let bwfLinkItem = new PopupMenu.PopupMenuItem('Explore Bandwagon');
      bwfLinkItem.connect('activate', () =>
        Gio.app_info_launch_default_for_uri('https://bandwagon.fm/discover', null)
      );
      this.menu.addMenuItem(bwfLinkItem);

      let tibLinkItem = new PopupMenu.PopupMenuItem('Visit The Indie Beat');
      tibLinkItem.connect('activate', () =>
        Gio.app_info_launch_default_for_uri('https://theindiebeat.fm/', null)
      );
      this.menu.addMenuItem(tibLinkItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Channels menu
      const channelsMenu = new PopupMenu.PopupSubMenuMenuItem('Channels');
      channelsMenu.menu.actor.add_style_class_name('tibr-popup-sub-menu');
      this.menu.addMenuItem(channelsMenu);

      // Load channels
      this._loadChannels(channelsMenu);
    }

    async _loadChannels(channelsMenu) {
      try {
        const channels = await player.api.getChannels();

        // Clear existing items
        channelsMenu.menu.removeAll();

        if (channels.length === 0) {
          let emptyMenu = new PopupMenu.PopupMenuItem('No channels available',
            { reactive: false });
          channelsMenu.menu.addMenuItem(emptyMenu);
          return;
        }

        // Add each channel
        channels.forEach((ch) => {
          channelsMenu.menu.addMenuItem(
            new ChannelBox(ch, player, popup)
          );
        });
      } catch (error) {
        console.error('TIBR: Error loading channels:', error);
        let errorMenu = new PopupMenu.PopupMenuItem('Error loading channels',
          { reactive: false });
        channelsMenu.menu.addMenuItem(errorMenu);
      }
    }
  }
);

export default class TIBRRadioExtension extends Extension {
  enable() {
    extPath = this.path;
    player = new Radio.RadioPlayer();
    // TODO: save/restore volume
    player.setVolume(0.5); // Default volume

    button = new TIBRPanelButton(player);
    Main.panel.addToStatusArea('tibr', button);
  }

  disable() {
    if (player) {
      player.cleanup();
    }
    if (popup) {
      popup.destroy();
    }
    if (button) {
      button.destroy();
    }
    button = null;
    popup = null;
    player = null;
  }
}
