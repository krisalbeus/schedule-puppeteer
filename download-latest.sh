#!/bin/bash

set -e

rm -fr chrome-aws-lambda
git clone --depth=1 https://github.com/alixaxel/chrome-aws-lambda.git && \
cd chrome-aws-lambda && \
make ../chrome-layer-1/chrome.zip
echo 'Layer created successfully!'
