import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, PartialType, PickType } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { User } from '../users/user.entity';
import { PostsService } from './posts.service';

class CreatePostDto {
  @IsOptional()
  @IsUUID()
  communityId?: string;

  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsOptional()
  @IsIn(['Text', 'Image', 'Video', 'Audio', 'Poll', 'Announcement'])
  type?: 'Text' | 'Image' | 'Video' | 'Audio' | 'Poll' | 'Announcement';

  @IsOptional()
  @IsString()
  @MaxLength(10000)
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(2048, { each: true })
  mediaUrls?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  mediaMimeTypes?: string[];

  @IsOptional()
  @IsString()
  @MaxLength(300)
  pollQuestion?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  pollOptions?: string[];
}

class UpdatePostDto extends PartialType(PickType(CreatePostDto, ['content', 'type'] as const)) {}

class CommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;

  @IsOptional()
  @IsUUID()
  parentCommentId?: string;
}

class PollVoteDto {
  @IsUUID()
  optionId!: string;
}

class ReactionDto {
  @IsOptional()
  @IsIn(['Like', 'Love', 'Celebrate', 'Support'])
  type?: 'Like' | 'Love' | 'Celebrate' | 'Support';
}

class ReportPostDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason!: string;
}

class UpdateCommentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content!: string;
}

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async feed(@CurrentUser() user: User, @Query('beforeId') beforeId?: string) {
    return this.postsService.getFeed(user.id, beforeId);
  }

  @Get('community/:communityId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async communityFeed(
    @CurrentUser() user: User,
    @Param('communityId') communityId: string,
    @Query('beforeId') beforeId?: string,
  ) {
    return this.postsService.getCommunityFeed(user.id, communityId, beforeId);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@CurrentUser() user: User, @Body() dto: CreatePostDto) {
    return this.postsService.createPost(user.id, dto);
  }

  @Get(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getById(@CurrentUser() user: User, @Param('postId') postId: string) {
    return this.postsService.getById(postId, user.id);
  }

  @Patch(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async update(@CurrentUser() user: User, @Param('postId') postId: string, @Body() dto: UpdatePostDto) {
    return this.postsService.updatePost(user.id, postId, dto);
  }

  @Delete(':postId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async delete(@CurrentUser() user: User, @Param('postId') postId: string) {
    return this.postsService.deletePost(user.id, postId);
  }

  @Post(':postId/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addReaction(@CurrentUser() user: User, @Param('postId') postId: string, @Body() dto: ReactionDto) {
    return this.postsService.addReaction(user.id, postId, dto.type);
  }

  @Delete(':postId/reactions')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async removeReaction(@CurrentUser() user: User, @Param('postId') postId: string) {
    return this.postsService.removeReaction(user.id, postId);
  }

  @Get(':postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async comments(@CurrentUser() user: User, @Param('postId') postId: string) {
    return this.postsService.getComments(postId, user.id);
  }

  @Post(':postId/comments')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async addComment(@CurrentUser() user: User, @Param('postId') postId: string, @Body() dto: CommentDto) {
    return this.postsService.addComment(user.id, postId, dto);
  }

  @Patch('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async updateComment(@CurrentUser() user: User, @Param('commentId') commentId: string, @Body() dto: UpdateCommentDto) {
    return this.postsService.updateComment(user.id, commentId, dto.content);
  }

  @Delete('comments/:commentId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async deleteComment(@CurrentUser() user: User, @Param('commentId') commentId: string) {
    return this.postsService.deleteComment(user.id, commentId);
  }

  @Post(':postId/report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async reportPost(@CurrentUser() user: User, @Param('postId') postId: string, @Body() dto: ReportPostDto) {
    return this.postsService.reportPost(user.id, postId, dto.reason);
  }

  @Post(':postId/poll/votes')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async votePoll(@CurrentUser() user: User, @Param('postId') postId: string, @Body() dto: PollVoteDto) {
    return this.postsService.votePoll(user.id, postId, dto.optionId);
  }
}
