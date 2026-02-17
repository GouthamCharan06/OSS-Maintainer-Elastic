import { ElasticTool } from '../tools/ElasticTool';
import { RiskScoreTool } from '../tools/RiskScoreTool';
import { AnalyticsTool } from '../tools/AnalyticsTool';
import type { RiskResult, ClassifiedPR, ReviewerSuggestion, RiskTrace } from '../types';

export const RiskStep = {
  name: 'Analyzing Risk',
  description: 'Analyzes PR risk metrics with deterministic weighted scoring and persists structured reasoning traces to Elasticsearch.',

  run: async (repo: string, onStep?: (step: string) => void): Promise<RiskResult> => {
    const client = ElasticTool.getClient();

    onStep?.('Retrieving pull requests for risk analysis...');
    const result = await client.search({
      index: 'repo_prs',
      size: 50,
      query: { term: { repo } },
      sort: [{ risk_score: 'desc' }],
    });

    onStep?.('Generating deterministic reasoning traces...');
    const hits: ClassifiedPR[] = result.hits.hits.map(hit => {
      const pr = hit._source as Record<string, unknown>;
      const riskScore = (pr.risk_score as number) || 0;
      const riskFactors = (pr.risk_factors as RiskTrace[]) || [];

      // Classification
      let classification = 'Safe';
      if (riskScore >= 60) classification = 'Immediate Review';
      else if (riskScore >= 30) classification = 'Schedule Review';

      // Label suggestions
      const suggested_labels = RiskScoreTool.suggestLabels(riskFactors);

      return {
        pr_number: pr.pr_number as number,
        title: pr.title as string,
        state: pr.state as string,
        author: pr.author as string,
        risk_score: riskScore,
        classification,
        reasoning_trace: riskFactors,
        suggested_labels,
        ci_status: pr.ci_status as string,
        pr_age_days: pr.pr_age_days as number,
        files_changed: pr.files_changed as number,
        lines_added: pr.lines_added as number,
        lines_deleted: pr.lines_deleted as number,
        labels: (pr.labels as string[]) || [],
        html_url: pr.html_url as string,
        is_first_time_contributor: pr.is_first_time_contributor as boolean,
      };
    });

    // Persist reasoning traces to ES
    onStep?.('Persisting reasoning traces to Elasticsearch...');
    const runId = `run-${Date.now()}`;
    const traces = hits.map(pr => ({
      repo,
      pr_number: pr.pr_number,
      run_id: runId,
      risk_score: pr.risk_score,
      classification: pr.classification,
      factors: pr.reasoning_trace,
      suggested_labels: pr.suggested_labels,
    }));
    await ElasticTool.indexReasoningTraces(traces);

    // Get reviewer suggestions from contributor ranking
    onStep?.('Computing reviewer suggestions from ES analytics...');
    let reviewerSuggestions: ReviewerSuggestion[] = [];
    try {
      const ranking = await AnalyticsTool.getContributorRanking(repo);
      reviewerSuggestions = ranking.slice(0, 5).map(c => ({
        login: c.author,
        merged_count: c.merged_count,
        reason: `Top contributor with ${c.merged_count} merged PRs. Familiar with the codebase.`,
      }));
    } catch {
      // Contributor data may not be available
    }

    onStep?.('Risk analysis complete.');

    return {
      high_risk_prs: hits,
      total_analyzed: hits.length,
      reviewer_suggestions: reviewerSuggestions,
    };
  }
};
