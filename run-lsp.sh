#!/bin/bash
cd /home/user/git/janus-project && exec pnpm exec typescript-language-server --stdio "$@"
