/**
 * ce.js — Communications Engine (ce)
 * 
 * Unified communication helper providing .reply() and .forward() methods
 * that automatically route to the correct backend API based on context.
 * 
 * Usage:
 *   import ce from '../../services/ce'
 *   await ce.reply('application', id, { subject, body })
 *   await ce.forward('application', id, 'secretary')
 *   await ce.reply('request', id, { subject, body })
 *   await ce.forward('request', id, 'manager')
 *   await ce.reply('notification', id, { message })
 */

import { applicationsAPI, requestsAPI, notificationsAPI } from './api'

/**
 * Validate the context type against allowed contexts
 */
function validateContext(context) {
  const validContexts = ['application', 'request', 'notification']
  if (!validContexts.includes(context)) {
    throw new Error(
      `ce.${context} is not a valid context. Valid contexts: ${validContexts.join(', ')}`
    )
  }
}

/**
 * Communications Engine — unified interface for sending replies
 * and forwarding items to managers or other roles.
 */
const ce = {
  /**
   * Send a reply via the appropriate API based on context
   * 
   * @param {'application'|'request'|'notification'} context - The type of item
   * @param {string|number} id - The item ID
   * @param {Object} data - The reply data
   * @param {string} data.subject - Subject line (applications/requests)
   * @param {string} data.body - Body content (applications/requests)
   * @param {string} [data.message] - Message content (notifications)
   * @returns {Promise<Object>} API response
   */
  async reply(context, id, data) {
    validateContext(context)

    try {
      let response

      switch (context) {
        case 'application':
          response = await applicationsAPI.reply(id, {
            subject: data.subject,
            body: data.body,
          })
          break

        case 'request':
          response = await requestsAPI.reply(id, {
            subject: data.subject,
            body: data.body,
          })
          break

        case 'notification':
          response = await notificationsAPI.reply(id, {
            message: data.message,
          })
          break

        default:
          throw new Error(`ce.reply: unsupported context '${context}'`)
      }

      console.log(
        `[ce] Reply sent — context: ${context}, id: ${id}, subject: ${data.subject || '(no subject)'}`
      )
      return response
    } catch (error) {
      console.error(`[ce] Reply failed — context: ${context}, id: ${id}:`, error.message)
      throw error
    }
  },

  /**
   * Forward an item to a manager (or other role) via the appropriate API
   * 
   * @param {'application'|'request'|'notification'} context - The type of item
   * @param {string|number} id - The item ID
   * @param {string} [role] - The role to forward to (default varies by context)
   * @returns {Promise<Object>} API response
   */
  async forward(context, id, role) {
    validateContext(context)

    try {
      let response

      switch (context) {
        case 'application':
          // Applications can be forwarded to secretary or director
          const forwardRole = role || 'secretary'
          if (!['secretary', 'director'].includes(forwardRole)) {
            throw new Error(
              `ce.forward: applications can only be forwarded to 'secretary' or 'director', got '${forwardRole}'`
            )
          }
          response = await applicationsAPI.forward(id, forwardRole)
          break

        case 'request':
          // Requests can be forwarded to manager
          response = await requestsAPI.forward(id, role || 'manager')
          break

        case 'notification':
          // Notifications can be forwarded to any role
          response = await notificationsAPI.forward(id, { assigned_role: role || 'manager' })
          break

        default:
          throw new Error(`ce.forward: unsupported context '${context}'`)
      }

      console.log(
        `[ce] Forward sent — context: ${context}, id: ${id}, role: ${role || 'default'}`
      )
      return response
    } catch (error) {
      console.error(`[ce] Forward failed — context: ${context}, id: ${id}:`, error.message)
      throw error
    }
  },
}

export default ce