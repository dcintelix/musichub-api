import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PostType, Prisma, ReactionType } from '@prisma/client';
import { OrganizationsService } from '../organizations/organizations.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly organizationsService: OrganizationsService,
  ) {}

  async getFeed(userId: string, beforeId?: string) {
    const visibleCommunityPost: Prisma.PostWhereInput = {
      OR: [
        { communityId: null },
        { community: { is: { type: 'Public' } } },
        { community: { is: { type: 'Private', members: { some: { userId, status: 'Active' } } } } },
      ],
    };
    const visibleOrganizationPost: Prisma.PostWhereInput = {
      OR: [
        { organizationId: null },
        { organization: { is: { isActive: true, isPublished: true } } },
      ],
    };
    const cursor = beforeId
      ? await this.prisma.post.findFirst({
          where: {
            id: beforeId,
            AND: [visibleCommunityPost, visibleOrganizationPost],
          },
          select: { id: true, createdAt: true },
        })
      : null;

    if (beforeId && !cursor) {
      throw new BadRequestException('Feed cursor is invalid.');
    }

    return this.prisma.post.findMany({
      where: {
        AND: [
          visibleCommunityPost,
          visibleOrganizationPost,
          ...(cursor
            ? [{
                OR: [
                  { createdAt: { lt: cursor.createdAt } },
                  { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
              }]
            : []),
        ],
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        community: true,
        organization: { select: { id: true, name: true, type: true, logoUrl: true } },
        comments: { select: { id: true } },
        reactions: true,
        media: true,
        poll: { include: { options: { include: { votes: { select: { userId: true } } } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
    });
  }

  async getCommunityFeed(userId: string, communityId: string, beforeId?: string) {
    const community = await this.prisma.community.findUnique({
      where: { id: communityId },
      select: { id: true, ownerId: true, type: true },
    });
    if (!community || (community.type === 'Private' && community.ownerId !== userId &&
      !await this.prisma.communityMember.findFirst({
        where: { communityId, userId, status: 'Active' },
        select: { id: true },
      }))) {
      throw new NotFoundException('Community not found.');
    }

    const cursor = beforeId
      ? await this.prisma.post.findFirst({
          where: { id: beforeId, communityId, OR: [{ organizationId: null }, { organization: { is: { isActive: true, isPublished: true } } }] },
          select: { id: true, createdAt: true },
        })
      : null;
    if (beforeId && !cursor) {
      throw new BadRequestException('Feed cursor is invalid.');
    }

    return this.prisma.post.findMany({
      where: {
        communityId,
        AND: [
          { OR: [{ organizationId: null }, { organization: { is: { isActive: true, isPublished: true } } }] },
          ...(cursor
            ? [{
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            }]
            : []),
        ],
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        community: { select: { id: true, name: true } },
        organization: { select: { id: true, name: true, type: true, logoUrl: true } },
        comments: { select: { id: true } },
        reactions: true,
        media: true,
        poll: { include: { options: { include: { votes: { select: { userId: true } } } } } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 30,
    });
  }

  async getById(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        community: true,
        organization: { select: { id: true, name: true, type: true, logoUrl: true, isActive: true, isPublished: true } },
        comments: {
          include: {
            author: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
            reactions: true,
          },
        },
        reactions: true,
        media: true,
        poll: { include: { options: { include: { votes: true } } } },
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    await this.assertCanViewPost(userId, post);

    return post;
  }

  private async assertCanViewPost(userId: string, post: {
    communityId: string | null;
    community: { type: string; ownerId: string } | null;
    organizationId?: string | null;
    organization?: { isActive: boolean; isPublished: boolean } | null;
  }) {
    if (post.organizationId && (!post.organization?.isActive || !post.organization.isPublished)) {
      throw new NotFoundException('Post not found.');
    }
    if (!post.communityId || !post.community || post.community.type !== 'Private' || post.community.ownerId === userId) {
      return;
    }

    const membership = await this.prisma.communityMember.findUnique({
      where: { communityId_userId: { communityId: post.communityId, userId } },
      select: { status: true },
    });
    if (membership?.status !== 'Active') {
      throw new NotFoundException('Post not found.');
    }
  }

  private async assertPostAccess(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        communityId: true,
        community: { select: { type: true, ownerId: true } },
        organizationId: true,
        organization: { select: { isActive: true, isPublished: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    await this.assertCanViewPost(userId, post);
  }

  async createPost(userId: string, payload: { communityId?: string; organizationId?: string; type?: PostType; content?: string; mediaUrls?: string[]; mediaMimeTypes?: string[]; pollQuestion?: string; pollOptions?: string[] }) {
    const type = payload.type ?? PostType.Text;
    const pollOptions = payload.pollOptions?.map((option) => option.trim()).filter(Boolean) ?? [];
    const pollQuestion = payload.pollQuestion?.trim();
    if (type === PostType.Poll && (!pollQuestion || pollOptions.length < 2)) {
      throw new BadRequestException('Poll posts require a question and at least two non-empty options.');
    }
    if (type !== PostType.Poll && (pollQuestion || pollOptions.length)) {
      throw new BadRequestException('Poll questions and options can only be included in poll posts.');
    }

    if (payload.organizationId) {
      await this.organizationsService.assertCanPublish(userId, payload.organizationId);
    }

    if (payload.communityId) {
      const community = await this.prisma.community.findUnique({
        where: { id: payload.communityId },
        select: { ownerId: true },
      });
      if (!community) {
        throw new NotFoundException('Community not found.');
      }
      if (community.ownerId !== userId) {
        const membership = await this.prisma.communityMember.findUnique({
          where: { communityId_userId: { communityId: payload.communityId, userId } },
          select: { status: true },
        });
        if (membership?.status !== 'Active') {
          throw new ForbiddenException('Join the community before posting there.');
        }
      }
    }

    const post = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.post.create({
        data: {
          authorId: userId,
          communityId: payload.communityId ?? null,
          organizationId: payload.organizationId ?? null,
          type,
          content: payload.content?.trim() || null,
        },
      });

      if (payload.mediaUrls?.length) {
        await transaction.postMedia.createMany({
          data: payload.mediaUrls.map((mediaUrl, index) => ({
            postId: created.id,
            mediaUrl: mediaUrl.trim(),
            mimeType: payload.mediaMimeTypes?.[index] ?? null,
          })),
        });
      }

      if (type === PostType.Poll) {
        if (!pollQuestion) {
          throw new BadRequestException('Poll posts require a question.');
        }
        await transaction.poll.create({
          data: {
            postId: created.id,
            question: pollQuestion,
            options: {
              create: pollOptions.map((option) => ({ text: option })),
            },
          },
        });
      }
      return created;
    });

    return this.getById(post.id, userId);
  }

  async votePoll(userId: string, postId: string, optionId: string) {
    await this.assertPostAccess(userId, postId);
    const poll = await this.prisma.poll.findUnique({
      where: { postId },
      include: { options: { where: { id: optionId }, select: { id: true } } },
    });

    if (!poll) {
      throw new NotFoundException('Poll not found.');
    }
    if (!poll.options.length) {
      throw new BadRequestException('Poll option does not belong to this post.');
    }

    return this.prisma.pollVote.upsert({
      where: { pollId_userId: { pollId: poll.id, userId } },
      update: { optionId },
      create: { pollId: poll.id, optionId, userId },
    });
  }

  async updatePost(userId: string, postId: string, payload: { content?: string; type?: PostType }) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, include: { community: true, organization: true } });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    await this.assertCanViewPost(userId, post);
    if (post.authorId !== userId && (!post.organizationId || !await this.organizationsService.canManage(userId, post.organizationId))) {
      throw new BadRequestException('You can only edit your own post or a post for an organization you manage.');
    }

    return this.prisma.post.update({
      where: { id: postId },
      data: {
        content: payload.content ?? post.content,
        type: payload.type ?? post.type,
      },
    });
  }

  async deletePost(userId: string, postId: string) {
    const post = await this.prisma.post.findUnique({ where: { id: postId }, select: { authorId: true, organizationId: true } });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    if (post.authorId !== userId && (!post.organizationId || !await this.organizationsService.canManage(userId, post.organizationId))) {
      throw new BadRequestException('You can only delete your own post or a post for an organization you manage.');
    }

    await this.prisma.post.delete({ where: { id: postId } });
    return { success: true };
  }

  async addReaction(userId: string, postId: string, type: ReactionType = ReactionType.Like) {
    await this.assertPostAccess(userId, postId);

    return this.prisma.postReaction.upsert({
      where: { postId_userId: { postId, userId } },
      update: { type },
      create: { postId, userId, type },
    });
  }

  async removeReaction(userId: string, postId: string) {
    await this.assertPostAccess(userId, postId);
    await this.prisma.postReaction.deleteMany({
      where: { postId, userId },
    });
    return { success: true };
  }

  async addComment(userId: string, postId: string, payload: { content: string; parentCommentId?: string }) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        communityId: true,
        community: { select: { type: true, ownerId: true } },
        organizationId: true,
        organization: { select: { isActive: true, isPublished: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    await this.assertCanViewPost(userId, post);

    return this.prisma.comment.create({
      data: {
        postId,
        authorId: userId,
        parentCommentId: payload.parentCommentId ?? null,
        content: payload.content,
      },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
      },
    });
  }

  async updateComment(userId: string, commentId: string, content: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        post: {
          select: {
            communityId: true,
            community: { select: { type: true, ownerId: true } },
            organizationId: true,
            organization: { select: { isActive: true, isPublished: true } },
          },
        },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    await this.assertCanViewPost(userId, comment.post);
    if (comment.authorId !== userId) {
      throw new BadRequestException('You can only edit your own comment.');
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { content },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        post: {
          select: {
            communityId: true,
            community: { select: { type: true, ownerId: true } },
            organizationId: true,
            organization: { select: { isActive: true, isPublished: true } },
          },
        },
      },
    });
    if (!comment) {
      throw new NotFoundException('Comment not found.');
    }
    await this.assertCanViewPost(userId, comment.post);
    if (comment.authorId !== userId) {
      throw new BadRequestException('You can only delete your own comment.');
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { success: true };
  }

  async getComments(postId: string, userId: string) {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: {
        communityId: true,
        community: { select: { type: true, ownerId: true } },
        organizationId: true,
        organization: { select: { isActive: true, isPublished: true } },
      },
    });
    if (!post) {
      throw new NotFoundException('Post not found.');
    }
    await this.assertCanViewPost(userId, post);

    return this.prisma.comment.findMany({
      where: { postId },
      include: {
        author: { select: { id: true, fullName: true, username: true, avatarMediaId: true, avatarUrl: true } },
        reactions: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async reportPost(userId: string, postId: string, reason: string) {
    await this.assertPostAccess(userId, postId);

    return this.prisma.postReport.create({
      data: {
        postId,
        reporterId: userId,
        reason,
        status: 'Open',
      },
    });
  }
}
