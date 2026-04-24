import axios from 'axios';
import chalk from 'chalk';
import { HackBridgeState } from '../utils/state';

export async function queryGroqRelay(
  state: HackBridgeState,
  promptType: string,
  context: any,
  options: { explain?: boolean; heavy?: boolean } = {}
): Promise<string> {
  const systemPrompt =
    promptType === 'debug'
      ? `You are a debugging assistant. Respond ONLY in exactly three sections with these exact headers, each preceded by a separator line of 40 dashes:\nWHAT BROKE | LIKELY CAUSE | SUGGESTED FIX\nNo preamble, no postamble.${options.explain ? ' Add a fourth section: WHY THIS HAPPENS.' : ''}`
      : 'You are a developer assistant. Be concise and actionable.';

  const userPrompt = JSON.stringify({
    context,
    error_info: context.stack_trace,
  });

  try {
    const res = await axios.post(
      `${state.api_base}/teams/${state.team_id}/cli/groq-relay`,
      {
        cli_token: state.cli_token,
        team_code: state.team_code,
        prompt_type: promptType,
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        heavy: options.heavy || false,
      },
      { timeout: 30000 }
    );
    return res.data.content as string;
  } catch (e: any) {
    if (e.code === 'ECONNABORTED') {
      throw new Error('Groq relay timed out (30s). The backend may be overloaded.');
    }
    if (e.response?.status === 401 || e.response?.status === 403) {
      throw new Error('Unauthorized — cli_token may be invalid or expired. Re-run `hackbridge init`.');
    }
    if (e.response?.status === 503) {
      throw new Error('Backend is unavailable. Is the API server running?');
    }
    throw new Error(e.response?.data?.detail || e.message || 'Unknown relay error');
  }
}
