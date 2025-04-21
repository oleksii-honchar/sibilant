#!/usr/bin/env node

import axios from 'axios';
import { config } from '@dotenvx/dotenvx';

config();

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('Error: OPENAI_API_KEY is not set in the .env file.');
  process.exit(1);
}

const fetchModels = async () => {
  try {
    const response = await axios.get('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`
      }
    });

    console.log('Available models:');
    response.data.data
      .sort((a: any, b: any) => a.id.localeCompare(b.id))
      .forEach((model: any) => {
        const createdDate = new Date(model.created * 1000).toISOString().split('T')[0];
        console.log(`${model.id} (created: ${createdDate})`);
      });
  } catch (error) {
    console.error('Error fetching models:', error);
  }
};

fetchModels();
