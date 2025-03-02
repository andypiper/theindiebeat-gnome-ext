# The Indie Beat - GNOME Shell Extension

The Indie Beat is a GNOME Shell extension that allows you to stream independent music from artists in the Fediverse, thanks to [The Indie Beat Radio FM](https://theindiebeat.fm), [Bandwagon](https://bandwagon.fm), and the artists who share their music there.

A simpler alternative for non-GNOME desktop users is [also available](https://github.com/andypiper/theindiebeat-simple-player).

## Features

- Stream music from [The Indie Beat](https://theindiebeat.fm/)
- Switch between different radio channels
- Control playback with play/pause buttons
- Adjust volume and mute audio
- View track metadata including title, artist, and album
- Open links to Bandwagon.fm and The Indie Beat in your browser

🎬 [Watch a demo video](https://makertube.net/w/3qSQBQSwPLqGyYtopiTAk4)

🎓 [Read about how I made this](https://andypiper.co.uk/2025/01/25/the-indie-beat-on-your-linux-desktop/)

<img src="https://raw.githubusercontent.com/andypiper/theindiebeat-gnome-ext/refs/heads/main/screenshots/screenshot1.png?sanitize=true" alt="Extension" height="420" align="top"> <img src="https://raw.githubusercontent.com/andypiper/theindiebeat-gnome-ext/refs/heads/main/screenshots/screenshot2.png?sanitize=true" alt="Playing" height="450" align="top"> <img src="https://raw.githubusercontent.com/andypiper/theindiebeat-gnome-ext/refs/heads/main/screenshots/screenshot4.png?sanitize=true" alt="Channels" height="520" align="top">

## Requirements

- A recent version of GNOME Shell
- GStreamer and plugins

## Installation

[<img src="https://raw.githubusercontent.com/andypiper/theindiebeat-gnome-ext/refs/heads/main/get-it-on-ego.svg?sanitize=true" alt="Get it on GNOME Extensions" height="140" align="top">](https://extensions.gnome.org/extension/7822/the-indie-beat-fediverse-radio/)

The extension is available to install [here](https://extensions.gnome.org/extension/7822/the-indie-beat-fediverse-radio/).

### Manual installation

1. Clone the repository:

    ```sh
    git clone https://github.com/andypiper/theindiebeat-gnome-ext.git
    ```

2. Navigate to the extension directory:

    ```sh
    cd theindiebeat-gnome-ext
    ```

3. Copy the extension to your GNOME Shell extensions directory:

    ```sh
    cp -r tibr-ext@andypiper.org ~/.local/share/gnome-shell/extensions/
    ```

    or, if the `just` command runner is installed:

    ```sh
    just install
    ```

4. Restart GNOME Shell:
    - Press `Alt + F2`, type `r`, and press `Enter`.
    - (on Wayland, logout and log back in)

5. Enable the extension using the Extensions app.

## Usage

- Click on the catellite icon in the top panel to open the extension menu.
- Switch between available channels from the Channels submenu.
- Open the Bandwagon.fm or The Indie Beat websites from the menu.
- When a track is playing:
  - Use the play/stop button to control playback.
  - Adjust the volume using the slider.
  - Hover over the artist and album text for a floating copy button; click to copy to clipboard.
  - Click on the View Artist Profile button to open the artist's profile on Bandwagon.fm.

## License

This project is licensed under the GPL v3 License. See `LICENSE` for details.

## Author

👤 **Andy Piper** - [@andypiper@macaw.social](https://macaw.social/@andypiper)

## Acknowledgements

- [Kirsten Lambertsen](https://mastodon.social/@mizkirsten) for being *awesome*.
- [The Indie Beat](https://theindiebeat.fm/) for providing the music streams.
- [Bandwagon.fm](https://bandwagon.fm/) for being an excellent part of the Fediverse.
- [Neil Brown's blog post](https://neilzone.co.uk/2025/01/adding-the-indie-beat-radio-fm-to-lyrion-music-server-mpd-and-jellyfin/) on using The Indie Beat streams in Linux music players.
- originally inspired by [the SomaFM extension](https://github.com/TheWeirdDev/somafm-radio-gnome-ext) for GNOME Shell (but shares no code, just the idea and a bit of the look).
- the [GNOME Extensions](https://extensions.gnome.org) reviewers for their excellent feedback! (aka, signal management is harder than I thought)

## Colophon

This extension is chock full of
📡🐱🛰️🎧 CATELLITE POWER 📡🐱🛰️🎧
