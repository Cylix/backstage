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
import React, { useState } from 'react';
import useAsync from 'react-use/lib/useAsync';
import { Grid, Typography } from '@material-ui/core';
import FullscreenIcon from '@material-ui/icons/Fullscreen';
import PeopleIcon from '@material-ui/icons/People';

import { useApi } from '@backstage/core-plugin-api';
import { catalogApiRef, useEntity } from '@backstage/plugin-catalog-react';
import { Progress, InfoCard } from '@backstage/core-components';

import { InfoCardHeader } from '../InfoCardHeader';
import { PullRequestBoardOptions } from '../PullRequestBoardOptions';
import { Wrapper } from '../Wrapper';
import { PullRequestCard } from '../PullRequestCard';
import { PRCardFormating } from '../../utils/types';
import { shouldDisplayCard } from '../../utils/functions';
import { DraftPrIcon } from '../icons/DraftPr';
import { getPullRequestsByTeam } from '../../hooks/getPullRequestsByTeam';
import { getUserRepositoriesAndTeam } from '../../hooks/getUserRepositoriesAndTeam';
import { useOctokitGraphQl } from '../../api/useOctokitGraphQl';

/** @public */
export interface EntityTeamPullRequestsCardProps {
  pullRequestLimit?: number;
}

const EntityTeamPullRequestsCard = (props: EntityTeamPullRequestsCardProps) => {
  const { pullRequestLimit } = props;
  const [infoCardFormat, setInfoCardFormat] = useState<PRCardFormating[]>([]);

  const { entity: teamEntity } = useEntity();
  const catalogApi = useApi(catalogApiRef);
  const graphql = useOctokitGraphQl();

  const { loading, value } = useAsync(async () => {
    const { repositories, teamMembers, teamMembersOrganization } =
      await getUserRepositoriesAndTeam(teamEntity, catalogApi);

    const { pullRequests, refreshPullRequests } = await getPullRequestsByTeam(
      graphql,
      repositories,
      teamMembers,
      teamMembersOrganization,
      pullRequestLimit,
    );

    return {
      repositories,
      teamMembers,
      pullRequests,
      refreshPullRequests,
    };
  }, [pullRequestLimit, teamEntity]);

  const repositories = value?.repositories ?? [];
  const teamMembers = value?.teamMembers ?? [];
  const pullRequests = value?.pullRequests ?? [];
  const refreshPullRequests = value?.refreshPullRequests;

  const header = (
    <InfoCardHeader onRefresh={refreshPullRequests}>
      <PullRequestBoardOptions
        onClickOption={newFormats => setInfoCardFormat(newFormats)}
        value={infoCardFormat}
        options={[
          {
            icon: <PeopleIcon />,
            value: 'team',
            ariaLabel: 'Show PRs from your team',
          },
          {
            icon: <DraftPrIcon />,
            value: 'draft',
            ariaLabel: 'Show draft PRs',
          },
          {
            icon: <FullscreenIcon />,
            value: 'fullscreen',
            ariaLabel: 'Set card to fullscreen',
          },
        ]}
      />
    </InfoCardHeader>
  );

  const getContent = () => {
    if (loading) {
      return <Progress />;
    }

    return (
      <Grid container spacing={2}>
        {pullRequests.length ? (
          pullRequests.map(({ title: columnTitle, content }) => (
            <Wrapper
              key={columnTitle}
              fullscreen={infoCardFormat.includes('fullscreen')}
            >
              <Typography variant="overline">{columnTitle}</Typography>
              {content.map(
                (
                  {
                    id,
                    title,
                    createdAt,
                    lastEditedAt,
                    author,
                    url,
                    latestReviews,
                    repository,
                    isDraft,
                  },
                  index,
                ) =>
                  shouldDisplayCard(
                    repository,
                    author,
                    repositories,
                    teamMembers,
                    infoCardFormat,
                    isDraft,
                  ) && (
                    <PullRequestCard
                      key={`pull-request-${id}-${index}`}
                      title={title}
                      createdAt={createdAt}
                      updatedAt={lastEditedAt}
                      author={author}
                      url={url}
                      reviews={latestReviews.nodes}
                      repositoryName={repository.name}
                      isDraft={isDraft}
                    />
                  ),
              )}
            </Wrapper>
          ))
        ) : (
          <Typography variant="overline">No pull requests found</Typography>
        )}
      </Grid>
    );
  };

  return <InfoCard title={header}>{getContent()}</InfoCard>;
};

export default EntityTeamPullRequestsCard;
