#!/bin/bash
echo "Publishing to JSR..."
deno publish --allow-dirty --config ./deno.json
exit