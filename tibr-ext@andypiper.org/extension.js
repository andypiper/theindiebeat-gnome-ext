// Copyright 2025 Andy Piper.
// SPDX-License-Identifier: GPL-3.0-only

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import GObject from 'gi://GObject';
import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import NM from 'gi://NM';

import * as Animation from 'resource:///org/gnome/shell/ui/animation.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Slider from 'resource:///org/gnome/shell/ui/slider.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Config from 'resource:///org/gnome/shell/misc/config.js';

import { INACTIVE_RESET_TIMEOUT } from './constants.js';
import * as Radio from './radio.js';

let player;
let button;
let popup;

export let extPath;

const TIBRPlayerPopup = GObject.registerClass(
  {
    GTypeName: 'TIBRPlayerPopup',
  },
  class TIBRPlayerPopup extends PopupMenu.PopupBaseMenuItem {
    _init(player) {

      const shellVersion = parseFloat(Config.PACKAGE_VERSION);
      this.shellVersion = shellVersion;

      super._init({
        hover: false,
        activate: false,
        can_focus: true,
      });

      this.isDefaultState = true;
      this._inactivityTimeoutId = null;
      this.volume = 0.5; // Default volume
      this.old_vol = 0;
      this.player = player;

      this.box = new St.BoxLayout({
	...(this.shellVersion >= 48
            ? { orientation: Clutter.Orientation.VERTICAL }
            : { vertical: true }
        ),
        width: 250,
      });

      // Volume control section
      this.volBox = new St.BoxLayout({
         ...(this.shellVersion >= 48
             ? { orientation: Clutter.Orientation.HORIZONTAL }
             : { vertical: false }
        ),
        width: 250,
      });

      this.loadingBox = new St.BoxLayout({
         ...(this.shellVersion >= 48
             ? { orientation: Clutter.Orientation.HORIZONTAL }
             : { vertical: false }
        ),
        x_align: Clutter.ActorAlign.CENTER,
        style_class: 'tibr-loading-box',
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
        style_class: 'tibr-volume-mute-icon',
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
      this.volBox.style_class = 'tibr-volume-box';

      // Loading indicator
      this.spinner = new Animation.Spinner(16);
      this.loadtxt = new St.Label({
        text: 'Loading...',
      });
      this.loadtxt.hide();

      // Control button
      this.controlbtns = new Radio.TIBRControlButtons(this.player, this);
      this.player.setOnError(() => {
        this.setError(false);
        this.setError(true);
      });

      this.box.add_child(this.controlbtns);

      // Track metadata container
      this.metadataBox = new St.BoxLayout({
         ...(this.shellVersion >= 48
             ? { orientation: Clutter.Orientation.VERTICAL }
             : { vertical: true }
        ),
        style_class: 'tibr-metadata-box',
      });

      // Track artwork
      this.artwork = new St.Icon({
        gicon: Gio.icon_new_for_string(extPath + '/images/catellite.png'),
        icon_size: 110,
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      this.trackTitle = new St.Label({
        text: 'Independent music',
        style_class: 'tibr-track-title',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      this.artistInfoBox = new St.BoxLayout({
        ...(this.shellVersion >= 48
            ? { orientation: Clutter.Orientation.VERTICAL }
            : { vertical: true }
        ),
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style_class: 'tibr-info-box',
        reactive: true
      });

      // Add hover handlers
      this.artistInfoBox.connect('enter-event', () => {
        if (!this.isDefaultState) this.artistCopyButton.show();
      });
      this.artistInfoBox.connect('leave-event', () => {
        this.artistCopyButton.hide();
      });

      this.artistName = new St.Label({
        text: 'from artists',
        style_class: 'tibr-track-artist',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      this.artistCopyButton = new St.Button({
        style_class: 'tibr-copy-button',
        child: new St.Icon({
          icon_name: 'edit-copy-symbolic',
          icon_size: 16
        }),
        visible: false
      });

      this.artistCopyButton.connect('clicked', () => {
        St.Clipboard.get_default().set_text(
          St.ClipboardType.CLIPBOARD,
          this.artistName.text
        );
      });

      this.artistInfoBox.add_child(this.artistName);
      this.artistInfoBox.add_child(this.artistCopyButton);

      this.albumInfoBox = new St.BoxLayout({
        ...(this.shellVersion >= 48
             ? { orientation: Clutter.Orientation.VERTICAL }
             : { vertical: true }
        ),
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
        style_class: 'tibr-info-box',
        reactive: true
      });

      this.albumInfoBox.connect('enter-event', () => {
        if (!this.isDefaultState) this.albumCopyButton.show();
      });
      this.albumInfoBox.connect('leave-event', () => {
        this.albumCopyButton.hide();
      });

      this.albumName = new St.Label({
        text: 'in the Fediverse',
        style_class: 'tibr-track-album',
        x_align: Clutter.ActorAlign.CENTER,
        x_expand: true,
      });

      this.albumCopyButton = new St.Button({
        style_class: 'tibr-copy-button',
        child: new St.Icon({
          icon_name: 'edit-copy-symbolic',
          icon_size: 16
        }),
        visible: false
      });

      this.albumCopyButton.connect('clicked', () => {
        St.Clipboard.get_default().set_text(
          St.ClipboardType.CLIPBOARD,
          this.albumName.text
        );
      });

      this.albumInfoBox.add_child(this.albumName);
      this.albumInfoBox.add_child(this.albumCopyButton);

      // Artist profile link
      this.artistLink = new St.Button({
        style_class: 'tibr-artist-link-button',
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
      this.metadataBox.add_child(this.artistInfoBox);
      this.metadataBox.add_child(this.albumInfoBox);
      this.metadataBox.add_child(this.artistLink);

      this.box.add_child(this.metadataBox);

      // Current channel indicator
      this.channelLabel = new St.Label({
        text: '',
        style_class: 'tibr-current-channel-label',
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

      this.isDefaultState = false;
      this._startInactivityTimer();

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
      this.trackTitle.set_text('Independent music');
      this.artistName.set_text('from artists');
      this.albumName.set_text('in the Fediverse');
      this.artistLink.hide();
      this.channelLabel.hide();
      this.artistCopyButton.visible = false;
      this.albumCopyButton.visible = false;
      this.currentExternalLink = null;
      this.loadtxt.hide();
    }

    _startInactivityTimer() {
      this._clearInactivityTimer();
      this._inactivityTimeoutId = GLib.timeout_add(
        GLib.PRIORITY_DEFAULT,
        INACTIVE_RESET_TIMEOUT,
        () => {
          this._resetToDefault();
          this._inactivityTimeoutId = null;
          return GLib.SOURCE_REMOVE;
        }
      );
    }

    _clearInactivityTimer() {
      if (this._inactivityTimeoutId) {
        GLib.Source.remove(this._inactivityTimeoutId);
        this._inactivityTimeoutId = null;
      }
    }

    _resetToDefault() {
      if (!this.player.isPlaying()) {
        this.isDefaultState = true;
        this._showDefaultMetadata();
      } else {
        // If still playing, restart the inactivity timer
        this._startInactivityTimer();
      }
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
        style_class: 'tibr-error-notification',
      });
      this.box.add_child(errorLabel);

      this._sourceId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, () => {
        errorLabel.destroy();
        return GLib.SOURCE_REMOVE;
      });
    }

    stopped() {
      this.controlbtns.icon.set_icon_name('media-playback-start-symbolic');
      this.controlbtns.playing = false;
      this.setLoading(false);
      this._showDefaultMetadata();
      this.artistCopyButton.hide();
      this.albumCopyButton.hide();
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

    destroy() {
      if (this._sourceId) {
        GLib.Source.remove(this._sourceId);
      }
      this._clearInactivityTimer();
      super.destroy();
    }
  }
);

const TIBRChannelMenuItem = GObject.registerClass(
  class TIBRChannelMenuItem extends PopupMenu.PopupBaseMenuItem {
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

const TIBRStatusButton = GObject.registerClass(
  {
    GTypeName: 'TIBRStatusButton',
  },
  class TIBRStatusButton extends PanelMenu.Button {
    _init(player) {
      super._init(0.0, 'TIBR');

      this.player = player;
      this._networkClient = null;
      this._networkMonitor = null;
      this._networkSignalId = 0;

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

      popup = new TIBRPlayerPopup(player);
      this.menu.addMenuItem(popup);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // TODO: consider some kind of sharing option

      // TODO: probably make these URLs constants
      let bwfLinkItem = new PopupMenu.PopupMenuItem('Explore Bandwagon');
      bwfLinkItem.connect('activate', () =>
        Gio.app_info_launch_default_for_uri('https://bandwagon.fm/albums', null)
      );
      this.menu.addMenuItem(bwfLinkItem);

      let tibLinkItem = new PopupMenu.PopupMenuItem('Visit The Indie Beat');
      tibLinkItem.connect('activate', () =>
        Gio.app_info_launch_default_for_uri('https://theindiebeat.fm/', null)
      );
      this.menu.addMenuItem(tibLinkItem);

      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      // Channels menu
      this.channelsMenu = new PopupMenu.PopupSubMenuMenuItem('Channels');
      this.channelsMenu.menu.actor.add_style_class_name('tibr-popup-sub-menu');
      this.menu.addMenuItem(this.channelsMenu);

      // Initialize network monitoring
      this._initNetworkMonitoring();

      // Load channels (first attempt)
      this._loadChannels(this.channelsMenu);
    }

    _initNetworkMonitoring() {
      try {
        // Set up NetworkManager client for monitoring connectivity
        this._networkClient = NM.Client.new(null);
        
        // Connect to state-changed signal
        this._networkSignalId = this._networkClient.connect(
          'notify::connectivity',
          this._onNetworkStateChanged.bind(this)
        );

        // Also use GNetworkMonitor as a fallback
        this._networkMonitor = Gio.NetworkMonitor.get_default();
        this._networkMonitorSignalId = this._networkMonitor.connect(
          'network-changed',
          this._onNetworkAvailabilityChanged.bind(this)
        );

        console.log('TIBR: Network monitoring initialized');
      } catch (error) {
        console.error('TIBR: Error setting up network monitoring:', error);
      }
    }

    _onNetworkStateChanged() {
      if (!this._networkClient) return;
      
      const connectivity = this._networkClient.connectivity;
      
      // NM.ConnectivityState.FULL = 4
      if (connectivity === NM.ConnectivityState.FULL) {
        console.log('TIBR: Network is fully connected, reloading channels');
        this._loadChannels(this.channelsMenu);
      }
    }

    _onNetworkAvailabilityChanged(monitor, available) {
      if (available) {
        console.log('TIBR: Network became available, reloading channels');
        this._loadChannels(this.channelsMenu);
      }
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

        // Sort channels, keeping ID 1 first, rest alphabetically by name
        const sortedChannels = [...channels].sort((a, b) => {
          // Keep channel with ID 1 at the top
          if (a.id === 1) return -1;
          if (b.id === 1) return 1;
          // Sort the rest alphabetically
          return a.getName().localeCompare(b.getName());
        });

        // Add each channel
        sortedChannels.forEach((ch) => {
          channelsMenu.menu.addMenuItem(
            new TIBRChannelMenuItem(ch, player, popup)
          );
        });
      } catch (error) {
        console.error('TIBR: Error loading channels:', error);
        let errorMenu = new PopupMenu.PopupMenuItem('Error loading channels',
          { reactive: false });
        channelsMenu.menu.addMenuItem(errorMenu);
      }
    }
    
    destroy() {
      // Clean up network monitoring
      if (this._networkClient && this._networkSignalId > 0) {
        this._networkClient.disconnect(this._networkSignalId);
        this._networkSignalId = 0;
      }
      
      if (this._networkMonitor && this._networkMonitorSignalId > 0) {
        this._networkMonitor.disconnect(this._networkMonitorSignalId);
        this._networkMonitorSignalId = 0;
      }
      
      this._networkClient = null;
      this._networkMonitor = null;
      
      super.destroy();
    }
  }
);

export default class TIBRRadioExtension extends Extension {
  enable() {
    extPath = this.path;
    player = new Radio.RadioPlayer();
    // TODO: save/restore volume
    player.setVolume(0.5); // initial default

    button = new TIBRStatusButton(player);
    Main.panel.addToStatusArea('tibr', button);
  }

  disable() {
    if (player) {
      player.cleanup();
      player = null;
    }
    if (popup) {
      popup.destroy();
      popup = null;
    }
    if (button) {
      button.destroy();
      button = null;
    }
  }
}
