#!/bin/bash
cd /home/kavia/workspace/code-generation/simple-calculator-app-330290/calculator_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

