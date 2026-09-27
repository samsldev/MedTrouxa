#!/bin/sh
# Faelith CLI installer stub. Replace with the signed release pipeline at go-live.
# Official install host: https://get.faelithindustries.com
set -eu
echo "Faelith CLI install"
echo "Until the release pipeline is live, build from source:"
echo "  cargo install --path crates/faelith-cli --locked"
echo "Then set FAELITH_API_BASE to your gateway origin."
exit 0
