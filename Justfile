NAME := "tibr-ext"
DOMAIN := "andypiper.org"
EXTENSION_ID := NAME + "@" + DOMAIN

# List available commands
default:
    @just --list

# Pack the extension using GNOME's tools and include extra sources
pack:
    @echo "Packaging extension to {{ EXTENSION_ID }}.shell-extension.zip"
    gnome-extensions pack --force \
        --extra-source=api.js \
        --extra-source=images \
        --extra-source=radio.js \
        --extra-source=constants.js \
        {{ EXTENSION_ID }}
    zip -u {{ EXTENSION_ID }}.shell-extension.zip LICENSE README.md CHANGELOG.md
    @echo "Extension packaged successfully"

# Install the extension to the user's home directory
install:
    @echo "Installing extension to ~/.local/share/gnome-shell/extensions/{{ EXTENSION_ID }}"
    @mkdir -p ~/.local/share/gnome-shell/extensions/{{ EXTENSION_ID }}
    @rm -rf ~/.local/share/gnome-shell/extensions/{{ EXTENSION_ID }}/*
    # Copy extension files from the tibr-ext@andypiper.org directory
    @cp -r {{ EXTENSION_ID }}/* ~/.local/share/gnome-shell/extensions/{{ EXTENSION_ID }}/
    @echo "Extension installed successfully"

# Start a nested GNOME Shell instance for testing
test:
    MUTTER_DEBUG_DUMMY_MODE_SPECS="1600x900@60.0" dbus-run-session -- gnome-shell --nested --wayland

# Install and then immediately test the extension
install-and-test: install
    @echo "Extension installed. Starting test environment..."
    @just test

# Create a GitHub release
release VERSION message="New release": pack
    @echo "Creating GitHub release v{{ VERSION }}..."
    gh release create v{{ VERSION }} \
        --title "v{{ VERSION }}" \
        --notes "{{ message }}" \
        {{ EXTENSION_ID }}.shell-extension.zip
    @echo "GitHub release created successfully"

# Update the version in metadata.json
update-version VERSION:
    @echo "Updating version to {{ VERSION }} in metadata.json"
    @sed -i 's/"version-name": "[^"]*"/"version-name": "{{ VERSION }}"/' {{ EXTENSION_ID }}/metadata.json
    @echo "Version updated successfully"

# Create a new release with version update
full-release VERSION message="New release":
    @just update-version {{ VERSION }}
    @just pack
    @echo "Creating GitHub release v{{ VERSION }}..."
    gh release create v{{ VERSION }} \
        --title "v{{ VERSION }}" \
        --notes "{{ message }}" \
        {{ EXTENSION_ID }}.shell-extension.zip
    @echo "Full release process completed successfully"

# Remove build artifacts
clean:
    @rm -rf {{ EXTENSION_ID }}.shell-extension.zip
    @echo "Build artifacts cleaned"
