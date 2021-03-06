import { Op } from 'sequelize';
import db from '../models';
import StatusResponse from '../helpers/StatusResponse';
import CommentQueryModel from '../lib/CommentQueryModel';
import { commentEvent } from '../lib/events';

const { comments } = db;
/**
 * @description CommentController class
 */
class CommentController {
  /**
   * @description Fetch all the users
   * @param {Object} req - HTTP Request
   * @param {Object} res - HTTP Response
   * @return {Object} Returned object
   */
  static async create(req, res) {
    const { content, isPrivate } = req.body;
    const { articleId } = req.params;
    const { userId } = req.app.locals.user;
    try {
      const comment = await comments.create({
        userId,
        articleId,
        content,
        isPrivate
      });

      const info = {
        articleId,
        userId,
        comment
      };

      const payload = {
        message: 'Comment has been successfully created',
        comment
      };

      commentEvent(info);
      return StatusResponse.created(res, payload);
    } catch (error) {
      const payload = {
        message: 'Cannot succesfully create a Comment',
        error: {
          body: [`Internal server error => ${error}`]
        }
      };
      return StatusResponse.internalServerError(res, payload);
    }
  }

  /**
   * @description Fetch all the users
   * @param {Object} req - HTTP Request
   * @param {Object} res - HTTP Response
   * @return {Object} Returned object
   */
  static async list(req, res) {
    const { articleId } = req.params;
    const { article } = req.app.locals;
    try {
      if (req.app.locals.user) {
        
        const { userId } = req.app.locals.user;

        const articleUser = article.userId;
        const commentInfo = {
          userId,
          articleId
        };
        if (articleUser === userId) {
          const comment = await CommentQueryModel.getPrivateComment(commentInfo);
          if (!comment) {
            const payload = {
              message: 'No Comment exist'
            };
            return StatusResponse.notfound(res, payload);
          }
          const payload = {
            message: 'All Comment for the Article',
            comment
          };
          return StatusResponse.success(res, payload);
        } else {
          const comment = await CommentQueryModel.getPublicComment(articleId);
          if (!comment) {
            const payload = {
              message: 'No Comment exist'
            };
            return StatusResponse.notfound(res, payload);
          }
          const payload = {
            message: 'All Comment for the Article',
            comment
          };
          return StatusResponse.success(res, payload);
        }
      }
      const comment = await CommentQueryModel.getAllPublicComment(articleId);
      if (!comment) {
        const payload = {
          message: 'No Comment exist'
        };
        return StatusResponse.notfound(res, payload);
      }
      const payload = {
        message: 'All Comment for the Article',
        comment
      };
      return StatusResponse.success(res, payload);
    } catch (error) {
      const payload = {
        message: 'Cannot successfully list out Comments',
        error: {
          body: [`Internal server error => ${error.message}`]
        }
      };
      return StatusResponse.internalServerError(res, payload);
    }
  }

  /**
   * @description Fetch all the users
   * @param {Object} req - HTTP Request
   * @param {Object} res - HTTP Response
   * @return {Object} Returned object
   */
  static async archive(req, res) {
    const { commentId } = req.params;
    try {
      await comments.update({
        isArchived: true,
      }, {
        where: {
          [Op.or]: [{ id: commentId }, { commentId }]
        }
      });
      const payload = {
        message: 'Successfully deleted'
      };
      return StatusResponse.success(res, payload);
    } catch (error) {
      const payload = {
        message: 'Cannot succesfully delete a Comment',
        error: {
          body: [`Internal server error => ${error}`]
        }
      };
      return StatusResponse.internalServerError(res, payload);
    }
  }
}

export default CommentController;
