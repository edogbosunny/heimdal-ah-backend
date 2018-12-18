import models from '../models';
import StatusResponse from '../helpers/StatusResponse';
import pagination from '../helpers/pagination';
import ArticleQueryModel from '../lib/ArticleQueryModel';
import {
  checkIdentifier,
  checkUser,
  checkTitle,
  createNewTags,
  calcReadingTime
} from '../helpers/articleHelper';

import highlitedTextsUpdater from '../lib/highlitedTextsUpdater';

const { articles: Article, tags: Tag, HighlightedText } = models;

/**
 * @description ArticlesController class
 */
class ArticlesController {
  /**
   * @description - create articles
   * @param {object} req
   * @param {object} res
   * @returns {object} Returned object
   */
  static async create(req, res) {
    const { userId } = req.app.locals.user;
    const {
      tags, body, title, description, image
    } = req.body;
    try {
      const articleTitle = await ArticleQueryModel.getArticleByTitle();
      const articleSlug = checkTitle(req.body.title, articleTitle);
      const readingTime = calcReadingTime(body);
      const newArticle = await Article.create({
        userId,
        title,
        description,
        body,
        image,
        readingTime,
        slug: articleSlug
      });

      if (tags) {
        const createdTags = await createNewTags(tags);
        await newArticle.addTags(createdTags);
        newArticle.dataValues.tags = tags;
      }

      const payload = { article: newArticle, message: 'Article successfully created' };
      return StatusResponse.created(res, payload);
    } catch (error) {
      return StatusResponse.internalServerError(res, {
        message: `Something went wrong, please try again.... ${error}`
      });
    }
  }

  /**
   * @description - list articles
   * @param {object} req
   * @param {object} res
   * @returns {object} Returned object
   */
  static async list(req, res) {
    const {
      size, page = 1, order = 'ASC', orderBy = 'id'
    } = req.query;
    try {
      // const { limit, offset } = pagination(page, size);
      const articles = await Article.findAndCountAll({
        include: [
          {
            model: Tag,
            as: 'tags',
            attributes: ['tagName'],
            through: {
              attributes: []
            }
          },
          {
            model: HighlightedText,
            as: 'highlightedPortions'
          }
        ],
        order: [[orderBy, order]]
      });

      const {
        limit, offset, totalPages, currentPage
      } = pagination(page, size, articles.count);

      const fetchedArticles = articles.rows.slice(
        offset,
        parseInt(offset, 10) + parseInt(limit, 10)
      );

      if (articles.length === 0) {
        return StatusResponse.success(res, {
          message: 'No article found'
        });
      }
      return StatusResponse.success(res, {
        message: 'List of articles',
        articles: fetchedArticles,
        metadata: {
          count: articles.count,
          currentPage,
          articleCount: articles.length,
          limit,
          totalPages
        }
      });
    } catch (error) {
      return StatusResponse.internalServerError(res, {
        message: `something went wrong, please try again.... ${error}`
      });
    }
  }

  /**
   * @description - fetch single article
   * @param {object} req
   * @param {object} res
   * @returns {object} Returned object
   */
  static async get(req, res) {
    const whereFilter = checkIdentifier(req.params.identifier);

    try {
      const fetchArticle = await Article.findOne({
        where: { ...whereFilter },
        include: [
          {
            model: Tag,
            as: 'tags',
            attributes: ['tagName'],
            through: {
              attributes: []
            }
          },
          {
            model: HighlightedText,
            as: 'highlightedPortions'
          }
        ]
      });
      return StatusResponse.success(res, {
        message: 'success',
        article: fetchArticle
      });
    } catch (error) {
      return StatusResponse.internalServerError(res, {
        message: `something went wrong, please try again.... ${error}`
      });
    }
  }

  /**
   * @description - update article
   * @param {object} req
   * @param {object} res
   * @returns {object} Returned object
   */
  static async update(req, res) {
    const { articles } = models;
    const { userId } = req.app.locals.user;
    const whereFilter = checkIdentifier(req.params.identifier);

    const { body, title, tags } = req.body;
    try {
      const article = await ArticleQueryModel.getArticleByIdentifier(whereFilter);
      if (!checkUser(article, userId)) {
        return StatusResponse.forbidden(res, {
          message: 'Request denied'
        });
      }
      if (title) {
        req.body.slug = checkTitle(title, title);
      }
      if (body) {
        req.body.readingTime = calcReadingTime(body);
      }

      const updatedArticle = await articles.update(req.body, {
        where: { ...whereFilter },
        fields: ['title', 'body', 'readingTime', 'description', 'image', 'isPublished'],
        returning: true
      });

      if (tags) {
        const createdTags = await createNewTags(tags);
        await article.setTags(createdTags);
        updatedArticle['1']['0'].dataValues.tags = tags;
      }

      const reqBody = {
        body: updatedArticle[1][0].body,
        highlightedPortions: article.highlightedPortions
      };
      const newUpdatedPortions = await highlitedTextsUpdater(userId, article.id, reqBody, res);
      if (!newUpdatedPortions) {
        return StatusResponse.success(res, {
          message: 'Article updated successfully, no highlights weere adjusted',
          article: updatedArticle,
          highlightedPortions: article.dataValues.highlightedPortions
        });
      }
      return StatusResponse.success(res, {
        message: 'Article updated successfully, some highlights were adjusted or removed',
        article: updatedArticle,
        highlightedPortions: newUpdatedPortions
      });
    } catch (error) {
      // console.log(error);
      return StatusResponse.internalServerError(res, {
        message: `something went wrong, please try again.... ${error}`
      });
    }
  }

  /**
   * @description - delete article
   * @param {object} req
   * @param {object} res
   * @returns {object} Returned object
   */
  static async archive(req, res) {
    const { articles } = models;
    const { userId } = req.app.locals.user;
    const whereFilter = checkIdentifier(req.params.identifier);
    try {
      const article = await ArticleQueryModel.getArticleByIdentifier(whereFilter);
      if (!checkUser(article, userId)) {
        return StatusResponse.forbidden(res, {
          message: 'Request denied'
        });
      }
      const data = { isArchived: true };
      await articles.update(data, {
        where: { ...whereFilter },
        returning: true,
        plain: true
      });
      return StatusResponse.success(res, {
        message: 'Article deleted(archived) successfully'
      });
    } catch (error) {
      return StatusResponse.internalServerError(res, {
        message: `something went wrong, please try again.... ${error}`
      });
    }
  }
}

export default ArticlesController;
