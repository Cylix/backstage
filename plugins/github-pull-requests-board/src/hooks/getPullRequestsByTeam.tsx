/*
 * Copyright 2022 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import pLimit from 'p-limit';
import { formatPRsByReviewDecision } from '../utils/functions';
import { PullRequests } from '../utils/types';
import { getPullRequestsFromRepository } from '../api/getPullRequestsFromRepository';
import { getPullRequestsFromUser } from '../api/getPullRequestsFromUser';
import { getPullRequestDetails } from '../api/getPullRequestDetails';

export async function getPullRequestsByTeam(
  graphql: <T>(path: string, options?: any) => Promise<T>,
  repositories: string[],
  members: string[],
  organization?: string,
  pullRequestLimit?: number
) {
  const getPullRequestsFromRepositoryFn = getPullRequestsFromRepository(graphql);
  const getPullRequestsFromUserFn = getPullRequestsFromUser(graphql);
  const getPullRequestDetailsFn = getPullRequestDetails(graphql);

  const getPRsPerRepository = async (repository: string): Promise<PullRequests> => {
    const concurrencyLimit = pLimit(5);
    const pullRequestsNumbers = await getPullRequestsFromRepositoryFn(
      repository,
      pullRequestLimit,
    );

    const pullRequestsWithDetails = await Promise.all(
      pullRequestsNumbers.map(node =>
        concurrencyLimit(() =>
          getPullRequestDetailsFn(repository, node.number),
        ),
      ),
    );

    return pullRequestsWithDetails;
  };

  const getPRsPerTeamMember = async (
    teamMember: string,
    teamOrganization?: string,
  ): Promise<PullRequests> => {
    const concurrencyLimit = pLimit(3);
    const pullRequestsNumbers = await getPullRequestsFromUserFn(
      teamMember,
      teamOrganization,
      pullRequestLimit,
    );

    const pullRequestsWithDetails = await Promise.all(
      pullRequestsNumbers.map(node =>
        concurrencyLimit(() =>
          getPullRequestDetailsFn(
            `${node.repository.owner.login}/${node.repository.name}`,
            node.number,
          ),
        ),
      ),
    );

    return pullRequestsWithDetails;
  };

  const getPRsFromTeam = async (
    teamRepositories: string[],
    teamMembers: string[],
    teamOrganization?: string,
  ): Promise<PullRequests> => {
    const teamRepositoriesPromises = teamRepositories.map(repository =>
      getPRsPerRepository(repository),
    );

    const teamMembersPromises = teamMembers.map(teamMember =>
      getPRsPerTeamMember(teamMember, teamOrganization),
    );

    const teamPullRequests = await Promise.allSettled([
      ...teamRepositoriesPromises,
      ...teamMembersPromises,
    ]).then(promises =>
      promises.reduce((acc, curr) => {
        if (curr.status === 'fulfilled') {
          return [...acc, ...curr.value];
        }
        return acc;
      }, [] as PullRequests),
    );

    const uniqueTeamPullRequests = teamPullRequests.filter(
      (lhs, i) => teamPullRequests.findIndex(rhs => lhs.id === rhs.id) === i,
    );

    return uniqueTeamPullRequests;
  };

  const teamPullRequests = await getPRsFromTeam(
    repositories,
    members,
    organization,
  );

  return {
    pullRequests: formatPRsByReviewDecision(teamPullRequests),
  };
}
