#!/bin/sh

gnome-extensions pack -f --extra-source=api.js --extra-source=images --extra-source=radio.js --extra-source=constants.js tibr-ext@andypiper.org
zip -u tibr-ext@andypiper.org.shell-extension.zip LICENSE README.md CHANGELOG.md
