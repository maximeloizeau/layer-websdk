/**
 * There are two ways to instantiate this class:
 *
 *      // 1. Using a Query Builder
 *      var queryBuilder = QueryBuilder.conversations().sortBy('lastMessage');
 *      var query = client.createQuery(client, queryBuilder);
 *
 *      // 2. Passing properties directly
 *      var query = client.createQuery({
 *        client: client,
 *        model: layer.Query.Conversation,
 *        sortBy: [{'createdAt': 'desc'}]
 *      });
 *
 * You can change the data selected by your query any time you want using:
 *
 *      query.update({
 *        paginationWindow: 200
 *      });
 *
 *      query.update({
 *        predicate: 'conversation.id = "' + conv.id + "'"
 *      });
 *
 *     // Or use the Query Builder:
 *     queryBuilder.paginationWindow(200);
 *     query.update(queryBuilder);
 *
 * You can release Conversations and Messages held in memory by your queries when done with them:
 *
 *      query.destroy();
 *
 * #### sortBy
 *
 * Note that the sortBy property is only supported for Conversations at this time and only
 * supports "createdAt" and "lastMessage.sentAt" as sort fields.
 *
 * #### dataType
 *
 * The layer.Query.dataType property lets you specify what type of data shows up in your results:
 *
 * ```javascript
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.InstanceDataType
 * })
 *
 * var query = client.createQuery({
 *     model: layer.Query.Message,
 *     predicate: "conversation.id = 'layer:///conversations/uuid'",
 *     dataType: layer.Query.ObjectDataType
 * })
 * ```
 *
 * The property defaults to layer.Query.InstanceDataType.  Instances support methods and let you subscribe to events for direct notification
 * of changes to any of the results of your query:
 *
* ```javascript
 * query.data[0].on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * A value of layer.Query.ObjectDataType will cause the data to be an array of immutable objects rather than instances.  One can still get an instance from the POJO:
 *
 * ```javascript
 * var m = client.getMessage(query.data[0].id);
 * m.on('messages:change', function(evt) {
 *     alert('The first message has had a property change; probably isRead or recipient_status!');
 * });
 * ```
 *
 * ## Query Events
 *
 * Queries fire events whenever their data changes.  There are 5 types of events;
 * all events are received by subscribing to the `change` event.
 *
 * ### 1. Data Events
 *
 * The Data event is fired whenever a request is sent to the server for new query results.  This could happen when first creating the query, when paging for more data, or when changing the query's properties, resulting in a new request to the server.
 *
 * The Event object will have an `evt.data` array of all newly added results.  But frequently you may just want to use the `query.data` array and get ALL results.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'data') {
 *      var newData = evt.data;
 *      var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:data', function(evt) {}` is also supported.
 *
 * ### 2. Insert Events
 *
 * A new Conversation or Message was created. It may have been created locally by your user, or it may have been remotely created, received via websocket, and added to the Query's results.
 *
 * The layer.LayerEvent.target property contains the newly inserted object.
 *
 * ```javascript
 *  query.on('change', function(evt) {
 *    if (evt.type === 'insert') {
 *       var newItem = evt.target;
 *       var allData = query.data;
 *    }
 *  });
 * ```
 *
 * Note that `query.on('change:insert', function(evt) {}` is also supported.
 *
 * ### 3. Remove Events
 *
 * A Conversation or Message was deleted. This may have been deleted locally by your user, or it may have been remotely deleted, a notification received via websocket, and removed from the Query results.
 *
 * The layer.LayerEvent.target property contains the removed object.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'remove') {
 *       var removedItem = evt.target;
 *       var allData = query.data;
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:remove', function(evt) {}` is also supported.
 *
 * ### 4. Reset Events
 *
 * Any time your query's model or predicate properties have been changed
 * the query is reset, and a new request is sent to the server.  The reset event informs your UI that the current result set is empty, and that the reason its empty is that it was `reset`.  This helps differentiate it from a `data` event that returns an empty array.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'reset') {
 *       var allData = query.data; // []
 *   }
 * });
 * ```
 *
 * Note that `query.on('change:reset', function(evt) {}` is also supported.
 *
 * ### 5. Property Events
 *
 * If any properties change in any of the objects listed in your layer.Query.data property, a `property` event will be fired.
 *
 * The layer.LayerEvent.target property contains object that was modified.
 *
 * See layer.LayerEvent.changes for details on how changes are reported.
 *
 * ```javascript
 * query.on('change', function(evt) {
 *   if (evt.type === 'property') {
 *       var changedItem = evt.target;
 *       var isReadChanges = evt.getChangesFor('isRead');
 *       var recipientStatusChanges = evt.getChangesFor('recipientStatus');
 *       if (isReadChanges.length) {
 *           ...
 *       }
 *
 *       if (recipientStatusChanges.length) {
 *           ...
 *       }
 *   }
 * });
 *```
 * Note that `query.on('change:property', function(evt) {}` is also supported.
 *
 * @class  layer.Query
 * @extends layer.Root
 *
 */
const Root = require('./root');
const LayerError = require('./layer-error');
const Util = require('./client-utils');
const Logger = require('./logger');
const { SYNC_STATE } = require('./const');

const CONVERSATION = 'Conversation';
const MESSAGE = 'Message';
const ANNOUNCEMENT = 'Announcement';
const IDENTITY = 'Identity';
const findConvIdRegex = new RegExp(
  /^conversation.id\s*=\s*['"]((layer:\/\/\/conversations\/)?.{8}-.{4}-.{4}-.{4}-.{12})['"]$/);

class Query extends Root {

  constructor(...args) {
    let options;
    if (args.length === 2) {
      options = args[1].build();
      options.client = args[0];
    } else {
      options = args[0];
    }

    super(options);
    this.predicate = this._fixPredicate(options.predicate || '');

    if ('paginationWindow' in options) {
      const paginationWindow = options.paginationWindow;
      this.paginationWindow = Math.min(this._getMaxPageSize(), options.paginationWindow);
      if (options.paginationWindow !== paginationWindow) {
        Logger.warn(`paginationWindow value ${paginationWindow} in Query constructor ` +
          `excedes Query.MaxPageSize of ${this._getMaxPageSize()}`);
      }
    }

    this.data = [];
    this._initialPaginationWindow = this.paginationWindow;
    if (!this.client) throw new Error(LayerError.dictionary.clientMissing);
    this.client.on('all', this._handleChangeEvents, this);

    if (!this.client.isReady) {
      this.client.once('ready', () => this._run(), this);
    } else {
      this._run();
    }
  }

  /**
   * Cleanup and remove this Query, its subscriptions and data.
   *
   * @method destroy
   */
  destroy() {
    this.client.off(null, null, this);
    this.client._removeQuery(this);
    this.data = null;
    super.destroy();
  }

  /**
   * Get the maximum number of items allowed in a page
   *
   * @method _getMaxPageSize
   * @private
   * @returns {number}
   */
  _getMaxPageSize() {
    return this.model === Query.Identity ? Query.MaxPageSizeIdentity : Query.MaxPageSize;
  }

  /**
   * Updates properties of the Query.
   *
   * Currently supports updating:
   *
   * * paginationWindow
   * * predicate
   * * model
   *
   * Any change to predicate or model results in clearing all data from the
   * query's results and triggering a change event with [] as the new data.
   *
   * @method update
   * @param  {Object} options
   * @param {string} [options.predicate] - A new predicate for the query
   * @param {string} [options.model] - A new model for the Query
   * @param {number} [paginationWindow] - Increase/decrease our result size to match this pagination window.
   * @return {layer.Query} this
   */
  update(options = {}) {
    let needsRefresh,
      needsRecreate;

    const optionsBuilt = (typeof options.build === 'function') ? options.build() : options;

    if ('paginationWindow' in optionsBuilt && this.paginationWindow !== optionsBuilt.paginationWindow) {
      this.paginationWindow = Math.min(this._getMaxPageSize() + this.size, optionsBuilt.paginationWindow);
      if (this.paginationWindow < optionsBuilt.paginationWindow) {
        Logger.warn(`paginationWindow value ${optionsBuilt.paginationWindow} in Query.update() ` +
          `increases size greater than Query.MaxPageSize of ${this._getMaxPageSize()}`);
      }
      needsRefresh = true;
    }
    if ('model' in optionsBuilt && this.model !== optionsBuilt.model) {
      this.model = optionsBuilt.model;
      needsRecreate = true;
    }

    if ('predicate' in optionsBuilt) {
      const predicate = this._fixPredicate(optionsBuilt.predicate || '');
      if (this.predicate !== predicate) {
        this.predicate = predicate;
        needsRecreate = true;
      }
    }
    if ('sortBy' in optionsBuilt && JSON.stringify(this.sortBy) !== JSON.stringify(optionsBuilt.sortBy)) {
      this.sortBy = optionsBuilt.sortBy;
      needsRecreate = true;
    }
    if (needsRecreate) {
      this._reset();
    }
    if (needsRecreate || needsRefresh) this._run();
    return this;
  }

  /**
   * Normalizes the predicate.
   *
   * @method _fixPredicate
   * @param {String} inValue
   * @private
   */
  _fixPredicate(inValue) {
    if (inValue === '') return '';
    if (this.model === Query.Message) {
      let conversationId = inValue.match(findConvIdRegex) ? inValue.replace(findConvIdRegex, '$1') : null;
      if (!conversationId) throw new Error(LayerError.dictionary.invalidPredicate);
      if (conversationId.indexOf('layer:///conversations/') !== 0) conversationId = 'layer:///conversations/' + conversationId;
      return `conversation.id = '${conversationId}'`;
    } else {
      throw new Error(LayerError.dictionary.predicateNotSupported);
    }
  }

  /**
   * After redefining the query, reset it: remove all data/reset all state.
   *
   * @method _reset
   * @private
   */
  _reset() {
    this.totalSize = 0;
    const data = this.data;
    this.data = [];
    this.client._checkAndPurgeCache(data);
    this.isFiring = false;
    this._predicate = null;
    this._nextDBFromId = '';
    this._nextServerFromId = '';
    this._isServerSyncing = false;
    this.pagedToEnd = false;
    this.paginationWindow = this._initialPaginationWindow;
    this._triggerChange({
      data: [],
      type: 'reset',
    });
  }

  /**
   * Reset your query to its initial state and then rerun it.
   *
   * @method reset
   */
  reset() {
    this._reset();
    this._run();
  }

  /**
   * Execute the query.
   *
   * No, don't murder it, just fire it.  No, don't make it unemployed,
   * just connect to the server and get the results.
   *
   * @method _run
   * @private
   */
  _run() {
    // Find the number of items we need to request.
    const pageSize = Math.min(this.paginationWindow - this.size, this._getMaxPageSize());

    // If there is a reduction in pagination window, then this variable will be negative, and we can shrink
    // the data.
    if (pageSize < 0) {
      const removedData = this.data.slice(this.paginationWindow);
      this.data = this.data.slice(0, this.paginationWindow);
      this.client._checkAndPurgeCache(removedData);
      this.pagedToEnd = false;
      this._triggerAsync('change', { data: [] });
    } else if (pageSize === 0 || this.pagedToEnd) {
      // No need to load 0 results.
    } else {
      switch (this.model) {
        case CONVERSATION:
          this._runConversation(pageSize);
          break;
        case MESSAGE:
          if (this.predicate) this._runMessage(pageSize);
          break;
        case ANNOUNCEMENT:
          this._runAnnouncement(pageSize);
          break;
        case IDENTITY:
          this._runIdentity(pageSize);
          break;
      }
    }
  }

  /**
   * Get Conversations from the server.
   *
   * @method _runConversation
   * @private
   * @param  {number} pageSize - Number of new results to request
   */
  _runConversation(pageSize) {
    const sortBy = this._getSortField();

    this.client.dbManager.loadConversations(sortBy, this._nextDBFromId, pageSize, (conversations) => {
      if (conversations.length) this._appendResults({ data: conversations }, true);
    });

    const newRequest = `conversations?sort_by=${sortBy}&page_size=${pageSize}` +
      (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

    if (newRequest !== this._firingRequest) {
      this.isFiring = true;
      this._firingRequest = newRequest;
      this.client.xhr({
        url: this._firingRequest,
        method: 'GET',
        sync: false,
      }, results => this._processRunResults(results, this._firingRequest, pageSize));
    }
  }

  /**
   * Returns the sort field for the query.
   *
   * Returns One of:
   *
   * * 'position' (Messages only)
   * * 'last_message' (Conversations only)
   * * 'created_at' (Conversations only)
   * @method _getSortField
   * @private
   * @return {String} sort key used by server
   */
  _getSortField() {
    if (this.model === MESSAGE || this.model === ANNOUNCEMENT) return 'position';
    if (this.sortBy && this.sortBy[0] && this.sortBy[0]['lastMessage.sentAt']) return 'last_message';
    return 'created_at';
  }

  /**
   * Get the Conversation UUID from the predicate property.
   *
   * Extract the Conversation's UUID from the predicate... or returned the cached value.
   *
   * @method _getConversationPredicateIds
   * @private
   */
  _getConversationPredicateIds() {
    if (this.predicate.match(findConvIdRegex)) {
      const conversationId = this.predicate.replace(findConvIdRegex, '$1');

      // We will already have a this._predicate if we are paging; else we need to extract the UUID from
      // the conversationId.
      const uuid = (this._predicate || conversationId).replace(/^layer:\/\/\/conversations\//, '');
      if (uuid) {
        return {
          uuid,
          id: conversationId,
        };
      }
    }
  }

  /**
   * Get Messages from the server.
   *
   * @method _runMessage
   * @private
   * @param  {number} pageSize - Number of new results to request
   */
  _runMessage(pageSize) {
    const predicateIds = this._getConversationPredicateIds();

    // Do nothing if we don't have a conversation to query on
    if (predicateIds) {
      const conversationId = 'layer:///conversations/' + predicateIds.uuid;
      if (!this._predicate) this._predicate = predicateIds.id;
      const conversation = this.client.getConversation(conversationId);

      // Retrieve data from db cache in parallel with loading data from server
      this.client.dbManager.loadMessages(conversationId, this._nextDBFromId, pageSize, (messages) => {
        if (messages.length) this._appendResults({ data: messages }, true);
      });

      const newRequest = `conversations/${predicateIds.uuid}/messages?page_size=${pageSize}` +
        (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

      // Don't query on unsaved conversations, nor repeat still firing queries
      if ((!conversation || conversation.isSaved()) && newRequest !== this._firingRequest) {
        this.isFiring = true;
        this._firingRequest = newRequest;
        this.client.xhr({
          url: newRequest,
          method: 'GET',
          sync: false,
        }, results => this._processRunResults(results, newRequest, pageSize));
      }

      // If there are no results, then its a new query; automatically populate it with the Conversation's lastMessage.
      if (this.data.length === 0) {
        if (conversation && conversation.lastMessage) {
          this.data = [this._getData(conversation.lastMessage)];
          // Trigger the change event
          this._triggerChange({
            type: 'data',
            data: this._getData(conversation.lastMessage),
            query: this,
            target: this.client,
          });
        }
      }
    } else if (!this.predicate.match(/['"]/)) {
      Logger.error('This query may need to quote its value');
    }
  }

  /**
   * Get Announcements from the server.
   *
   * @method _runAnnouncement
   * @private
   * @param  {number} pageSize - Number of new results to request
   */
  _runAnnouncement(pageSize) {
    // Retrieve data from db cache in parallel with loading data from server
    this.client.dbManager.loadAnnouncements(this._nextDBFromId, pageSize, (messages) => {
      if (messages.length) this._appendResults({ data: messages }, true);
    });

    const newRequest = `announcements?page_size=${pageSize}` +
      (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

    // Don't repeat still firing queries
    if (newRequest !== this._firingRequest) {
      this.isFiring = true;
      this._firingRequest = newRequest;
      this.client.xhr({
        url: newRequest,
        method: 'GET',
        sync: false,
      }, results => this._processRunResults(results, newRequest, pageSize));
    }
  }

  /**
   * Get Identities from the server.
   *
   * @method _runIdentities
   * @private
   * @param  {number} pageSize - Number of new results to request
   */
  _runIdentity(pageSize) {
    // There is not yet support for paging Identities;  as all identities are loaded,
    // if there is a _nextDBFromId, we no longer need to get any more from the database
    if (!this._nextDBFromId) {
      this.client.dbManager.loadIdentities((identities) => {
        if (identities.length) this._appendResults({ data: identities }, true);
      });
    }

    const newRequest = `identities?page_size=${pageSize}` +
      (this._nextServerFromId ? '&from_id=' + this._nextServerFromId : '');

    // Don't repeat still firing queries
    if (newRequest !== this._firingRequest) {
      this.isFiring = true;
      this._firingRequest = newRequest;
      this.client.xhr({
        url: newRequest,
        method: 'GET',
        sync: false,
      }, results => this._processRunResults(results, newRequest, pageSize));
    }
  }


  /**
   * Process the results of the `_run` method; calls __appendResults.
   *
   * @method _processRunResults
   * @private
   * @param  {Object} results - Full xhr response object with server results
   * @param {Number} pageSize - Number of entries that were requested
   */
  _processRunResults(results, requestUrl, pageSize) {
    if (requestUrl !== this._firingRequest || this.isDestroyed) return;
    const isSyncing = results.xhr.getResponseHeader('Layer-Conversation-Is-Syncing') === 'true';


    this.isFiring = false;
    this._firingRequest = '';
    if (results.success) {
      this._appendResults(results, false);
      this.totalSize = Number(results.xhr.getResponseHeader('Layer-Count'));

      if (results.data.length < pageSize) this.pagedToEnd = true;

      // If the server is syncing, and the query needs more data, keep polling the server,
      // and notify the client that we're polling.
      if (isSyncing && this.data.length < this.paginationWindow) {
        if (!this._isServerSyncing) {
          this._isServerSyncing = true;
          this.trigger('server-syncing-state', { syncing: true });
        }
        setTimeout(() => this._run(), 1500);
      }

       // If we're done polling the server (isSyncing is false OR we have enough data) notify the client that we're done.
      else if (this._isServerSyncing) {
        this._isServerSyncing = false;
        this.trigger('server-syncing-state', { syncing: false });
      }
    } else {
      this.trigger('error', { error: results.data });
    }
  }

  /**
   * Appends arrays of data to the Query results.
   *
   * @method  _appendResults
   * @private
   */
  _appendResults(results, fromDb) {
    // For all results, register them with the client
    // If already registered with the client, properties will be updated as needed
    // Database results rather than server results will arrive already registered.
    results.data.forEach((item) => {
      if (!(item instanceof Root)) this.client._createObject(item);
    });

    // Filter results to just the new results
    const newResults = results.data.filter(item => this._getIndex(item.id) === -1);

    // Update the next ID to use in pagination
    const resultLength = results.data.length;
    if (resultLength) {
      if (fromDb) this._nextDBFromId = results.data[resultLength - 1].id;
      else if (results.xhr.getResponseHeader('Layer-Conversation-Is-Syncing') !== 'true') {
        this._nextServerFromId = results.data[resultLength - 1].id;
      }
    }

    // Update this.data
    if (this.dataType === Query.ObjectDataType) {
      this.data = [].concat(this.data);
    }
    const data = this.data;

    // Insert the results... if the results are a match
    newResults.forEach((itemIn) => {
      let index;
      const item = this.client._getObject(itemIn.id);
      switch (this.model) {
        case MESSAGE:
        case ANNOUNCEMENT:
          index = this._getInsertMessageIndex(item, data);
          break;
        case CONVERSATION:
          index = this._getInsertConversationIndex(item, data);
          break;
        case IDENTITY:
          index = data.length;
          break;
      }
      data.splice(index, 0, this._getData(item));
    });


    // Trigger the change event
    this._triggerChange({
      type: 'data',
      data: newResults.map(item => this._getData(this.client._getObject(item.id))),
      query: this,
      target: this.client,
    });
  }

  /**
   * Returns a correctly formatted object representing a result.
   *
   * Format is specified by the `dataType` property.
   *
   * @method _getData
   * @private
   * @param  {layer.Root} item - Conversation or Message instance
   * @return {Object} - Conversation or Message instance or Object
   */
  _getData(item) {
    if (this.dataType === Query.ObjectDataType) {
      return item.toObject();
    }
    return item;
  }

  /**
   * Returns an instance regardless of whether the input is instance or object
   * @method _getInstance
   * @private
   * @param {layer.Root|Object} item - Conversation or Message object/instance
   * @return {layer.Root}
   */
  _getInstance(item) {
    if (item instanceof Root) return item;
    return this.client._getObject(item.id);
  }

  /**
   * Ask the query for the item matching the ID.
   *
   * Returns undefined if the ID is not found.
   *
   * @method _getItem
   * @private
   * @param  {string} id
   * @return {Object} Conversation or Message object or instance
   */
  _getItem(id) {
    switch (Util.typeFromID(id)) {
      case 'announcements':
        if (this.model === ANNOUNCEMENT) {
          const index = this._getIndex(id);
          return index === -1 ? null : this.data[index];
        }
        break;
      case 'messages':
        if (this.model === MESSAGE) {
          const index = this._getIndex(id);
          return index === -1 ? null : this.data[index];
        } else if (this.model === CONVERSATION) {
          for (let index = 0; index < this.data.length; index++) {
            const conversation = this.data[index];
            if (conversation.lastMessage && conversation.lastMessage.id === id) return conversation.lastMessage;
          }
          return null;
        }
        break;
      case 'conversations':
        if (this.model === CONVERSATION) {
          const index = this._getIndex(id);
          return index === -1 ? null : this.data[index];
        }
        break;
      case 'identities':
        if (this.model === IDENTITY) {
          const index = this._getIndex(id);
          return index === -1 ? null : this.data[index];
        }
        break;
    }
  }

  /**
   * Get the index of the item represented by the specified ID; or return -1.
   *
   * @method _getIndex
   * @private
   * @param  {string} id
   * @return {number}
   */
  _getIndex(id) {
    for (let index = 0; index < this.data.length; index++) {
      if (this.data[index].id === id) return index;
    }
    return -1;
  }

  /**
   * Handle any change event received from the layer.Client.
   *
   * These can be caused by websocket events, as well as local
   * requests to create/delete/modify Conversations and Messages.
   *
   * The event does not necessarily apply to this Query, but the Query
   * must examine it to determine if it applies.
   *
   * @method _handleChangeEvents
   * @private
   * @param {string} eventName - "messages:add", "conversations:change"
   * @param {layer.LayerEvent} evt
   */
  _handleChangeEvents(eventName, evt) {
    switch (this.model) {
      case CONVERSATION:
        this._handleConversationEvents(evt);
        break;
      case MESSAGE:
      case ANNOUNCEMENT:
        this._handleMessageEvents(evt);
        break;
      case IDENTITY:
        this._handleIdentityEvents(evt);
        break;
    }
  }

  _handleConversationEvents(evt) {
    switch (evt.eventName) {

      // If a Conversation's property has changed, and the Conversation is in this
      // Query's data, then update it.
      case 'conversations:change':
        this._handleConversationChangeEvent(evt);
        break;

      // If a Conversation is added, and it isn't already in the Query,
      // add it and trigger an event
      case 'conversations:add':
        this._handleConversationAddEvent(evt);
        break;

      // If a Conversation is deleted, and its still in our data,
      // remove it and trigger an event.
      case 'conversations:remove':
        this._handleConversationRemoveEvent(evt);
        break;
    }
  }

  // TODO WEB-968: Refactor this into functions for instance, object, sortBy createdAt, sortBy lastMessage
  _handleConversationChangeEvent(evt) {
    let index = this._getIndex(evt.target.id);

    // If its an ID change (matching Distinct Conversation returned by server) make sure to update our data.
    // If dataType is an instance, its been updated for us.
    if (this.dataType === Query.ObjectDataType) {
      const idChanges = evt.getChangesFor('id');
      if (idChanges.length) {
        index = this._getIndex(idChanges[0].oldValue);
      }
    }

    // If dataType is "object" then update the object and our array;
    // else the object is already updated.
    // Ignore results that aren't already in our data; Results are added via
    // conversations:add events.  Websocket Manager automatically loads anything that receives an event
    // for which we have no object, so we'll get the add event at that time.
    if (index !== -1) {
      const sortField = this._getSortField();
      const reorder = evt.hasProperty('lastMessage') && sortField === 'last_message';

      if (this.dataType === Query.ObjectDataType) {
        if (!reorder) {
          // Replace the changed Conversation with a new immutable object
          this.data = [
            ...this.data.slice(0, index),
            evt.target.toObject(),
            ...this.data.slice(index + 1),
          ];
        } else {
          const newIndex = this._getInsertConversationIndex(evt.target, this.data);
          this.data.splice(index, 1);
          this.data.splice(newIndex, 0, this._getData(evt.target));
          this.data = this.data.concat([]);
        }
      }

      // Else dataType is instance not object
      else {
        if (reorder) {
          const newIndex = this._getInsertConversationIndex(evt.target, this.data);
          if (newIndex !== index) {
            this.data.splice(index, 1);
            this.data.splice(newIndex, 0, evt.target);
          }
        }
      }

      // Trigger a 'property' event
      this._triggerChange({
        type: 'property',
        target: this._getData(evt.target),
        query: this,
        isChange: true,
        changes: evt.changes,
      });
    }
  }

  _getInsertConversationIndex(conversation, data) {
    if (!conversation.isSaved()) return 0;
    const sortField = this._getSortField();
    let index;
    if (sortField === 'created_at') {
      for (index = 0; index < data.length; index++) {
        const item = data[index];
        if (item.syncState === SYNC_STATE.NEW || item.syncState === SYNC_STATE.SAVING) continue;
        if (conversation.createdAt >= item.createdAt) break;
      }
      return index;
    } else {
      const d1 = conversation.lastMessage ? conversation.lastMessage.sentAt : conversation.createdAt;
      for (index = 0; index < data.length; index++) {
        const item = data[index];
        if (item.syncState === SYNC_STATE.NEW || item.syncState === SYNC_STATE.SAVING) continue;
        const d2 = item.lastMessage ? item.lastMessage.sentAt : item.createdAt;
        if (d1 >= d2) break;
      }
      return index;
    }
  }

  _getInsertMessageIndex(message, data) {
    let index;
    for (index = 0; index < data.length; index++) {
      if (message.position > data[index].position) {
        break;
      }
    }
    return index;
  }

  _handleConversationAddEvent(evt) {
    // Filter out any Conversations already in our data
    const list = evt.conversations
                  .filter(conversation => this._getIndex(conversation.id) === -1);

    if (list.length) {
      const data = this.data;
      list.forEach((conversation) => {
        const newIndex = this._getInsertConversationIndex(conversation, data);
        data.splice(newIndex, 0, this._getData(conversation));
      });

      // Whether sorting by last_message or created_at, new results go at the top of the list
      if (this.dataType === Query.ObjectDataType) {
        this.data = [].concat(data);
      }
      this.totalSize += list.length;

      // Trigger an 'insert' event for each item added;
      // typically bulk inserts happen via _appendResults().
      list.forEach((conversation) => {
        const item = this._getData(conversation);
        this._triggerChange({
          type: 'insert',
          index: this.data.indexOf(item),
          target: item,
          query: this,
        });
      });
    }
  }


  _handleConversationRemoveEvent(evt) {
    const removed = [];
    evt.conversations.forEach((conversation) => {
      const index = this._getIndex(conversation.id);
      if (index !== -1) {
        if (conversation.id === this._nextDBFromId) this._nextDBFromId = this._updateNextFromId(index);
        if (conversation.id === this._nextServerFromId) this._nextServerFromId = this._updateNextFromId(index);
        removed.push({
          data: conversation,
          index,
        });
        if (this.dataType === Query.ObjectDataType) {
          this.data = [...this.data.slice(0, index), ...this.data.slice(index + 1)];
        } else {
          this.data.splice(index, 1);
        }
      }
    });

    this.totalSize -= removed.length;
    removed.forEach((removedObj) => {
      this._triggerChange({
        type: 'remove',
        index: removedObj.index,
        target: this._getData(removedObj.data),
        query: this,
      });
    });
  }

  _handleMessageEvents(evt) {
    switch (evt.eventName) {

      // If a Conversation's ID has changed, check our predicate, and update it automatically if needed.
      case 'conversations:change':
        if (this.model === MESSAGE) this._handleMessageConvIdChangeEvent(evt);
        break;

      // If a Message has changed and its in our result set, replace
      // it with a new immutable object
      case 'messages:change':
      case 'messages:read':
        this._handleMessageChangeEvent(evt);
        break;

      // If Messages are added, and they aren't already in our result set
      // add them.
      case 'messages:add':
        this._handleMessageAddEvent(evt);
        break;

      // If a Message is deleted and its in our result set, remove it
      // and trigger an event
      case 'messages:remove':
        this._handleMessageRemoveEvent(evt);
        break;
    }
  }

  /**
   * A Conversation ID changes if a matching Distinct Conversation was found on the server.
   *
   * If this Query's Conversation's ID has changed, update the predicate.
   *
   * @method _handleMessageConvIdChangeEvent
   * @param {layer.LayerEvent} evt - A Message Change Event
   * @private
   */
  _handleMessageConvIdChangeEvent(evt) {
    const cidChanges = evt.getChangesFor('id');
    if (cidChanges.length) {
      if (this._predicate === cidChanges[0].oldValue) {
        this._predicate = cidChanges[0].newValue;
        this.predicate = "conversation.id = '" + this._predicate + "'";
        this._run();
      }
    }
  }

  /**
   * If the ID of the message has changed, then the position property has likely changed as well.
   *
   * This method tests to see if changes to the position property have impacted the message's position in the
   * data array... and updates the array if it has.
   *
   * @method _handleMessagePositionChange
   * @private
   * @param {layer.LayerEvent} evt  A Message Change event
   * @param {number} index  Index of the message in the current data array
   * @return {boolean} True if a data was changed and a change event was emitted
   */
  _handleMessagePositionChange(evt, index) {
    // If the message is not in the current data, then there is no change to our query results.
    if (index === -1) return false;

    // Create an array without our data item and then find out where the data item Should be inserted.
    // Note: we could just lookup the position in our current data array, but its too easy to introduce
    // errors where comparing this message to itself may yield index or index + 1.
    const newData = [
      ...this.data.slice(0, index),
      ...this.data.slice(index + 1),
    ];
    const newIndex = this._getInsertMessageIndex(evt.target, newData);

    // If the data item goes in the same index as before, then there is no change to be handled here;
    // else insert the item at the right index, update this.data and fire a change event
    if (newIndex !== index) {
      newData.splice(newIndex, 0, this._getData(evt.target));
      this.data = newData;
      this._triggerChange({
        type: 'property',
        target: this._getData(evt.target),
        query: this,
        isChange: true,
        changes: evt.changes,
      });
      return true;
    }
    return false;
  }

  _handleMessageChangeEvent(evt) {
    let index = this._getIndex(evt.target.id);
    const positionChanges = evt.getChangesFor('position');

    // If there are position changes, handle them.  If all the changes are position changes,
    // exit when done.
    if (positionChanges.length) {
      if (this._handleMessagePositionChange(evt, index)) {
        if (positionChanges.length === evt.changes.length) return;
        index = this._getIndex(evt.target.id); // Get the updated position
      }
    }

    if (index !== -1) {
      if (this.dataType === Query.ObjectDataType) {
        this.data = [
          ...this.data.slice(0, index),
          evt.target.toObject(),
          ...this.data.slice(index + 1),
        ];
      }
      this._triggerChange({
        type: 'property',
        target: this._getData(evt.target),
        query: this,
        isChange: true,
        changes: evt.changes,
      });
    }
  }

  _handleMessageAddEvent(evt) {
    // Only use added messages that are part of this Conversation
    // and not already in our result set
    const list = evt.messages
      // Filter so that we only see Messages if doing a Messages query or Announcements if doing an Announcements Query.
      .filter(message => {
        const type = Util.typeFromID(message.id);
        return type === 'messages' && this.model === MESSAGE ||
                type === 'announcements' && this.model === ANNOUNCEMENT;
      })
      // Filter out Messages that aren't part of this Conversation
      .filter(message => {
        const type = Util.typeFromID(message.id);
        return type === 'announcements' || message.conversationId === this._predicate;
      })
      // Filter out Messages that are already in our data set
      .filter(message => this._getIndex(message.id) === -1)
      .map(message => this._getData(message));

    // Add them to our result set and trigger an event for each one
    if (list.length) {
      const data = this.data = this.dataType === Query.ObjectDataType ? [].concat(this.data) : this.data;
      list.forEach((item) => {
        const index = this._getInsertMessageIndex(item, data);
        data.splice(index, 0, item);
      });

      this.totalSize += list.length;

      // Index calculated above may shift after additional insertions.  This has
      // to be done after the above insertions have completed.
      list.forEach((item) => {
        this._triggerChange({
          type: 'insert',
          index: this.data.indexOf(item),
          target: item,
          query: this,
        });
      });
    }
  }

  _handleMessageRemoveEvent(evt) {
    const removed = [];
    evt.messages.forEach((message) => {
      const index = this._getIndex(message.id);
      if (index !== -1) {
        if (message.id === this._nextDBFromId) this._nextDBFromId = this._updateNextFromId(index);
        if (message.id === this._nextServerFromId) this._nextServerFromId = this._updateNextFromId(index);
        removed.push({
          data: message,
          index,
        });
        if (this.dataType === Query.ObjectDataType) {
          this.data = [
            ...this.data.slice(0, index),
            ...this.data.slice(index + 1),
          ];
        } else {
          this.data.splice(index, 1);
        }
      }
    });

    this.totalSize -= removed.length;
    removed.forEach((removedObj) => {
      this._triggerChange({
        type: 'remove',
        target: this._getData(removedObj.data),
        index: removedObj.index,
        query: this,
      });
    });
  }

  _handleIdentityEvents(evt) {
    switch (evt.eventName) {

      // If a Identity has changed and its in our result set, replace
      // it with a new immutable object
      case 'identities:change':
        this._handleIdentityChangeEvent(evt);
        break;

      // If Identities are added, and they aren't already in our result set
      // add them.
      case 'identities:add':
        this._handleIdentityAddEvent(evt);
        break;

      // If a Identity is deleted and its in our result set, remove it
      // and trigger an event
      case 'identities:remove':
        this._handleIdentityRemoveEvent(evt);
        break;
    }
  }


  _handleIdentityChangeEvent(evt) {
    const index = this._getIndex(evt.target.id);

    if (index !== -1) {
      if (this.dataType === Query.ObjectDataType) {
        this.data = [
          ...this.data.slice(0, index),
          evt.target.toObject(),
          ...this.data.slice(index + 1),
        ];
      }
      this._triggerChange({
        type: 'property',
        target: this._getData(evt.target),
        query: this,
        isChange: true,
        changes: evt.changes,
      });
    }
  }

  _handleIdentityAddEvent(evt) {
    const list = evt.identities
      .filter(identity => this._getIndex(identity.id) === -1)
      .map(identity => this._getData(identity));

    // Add them to our result set and trigger an event for each one
    if (list.length) {
      const data = this.data = this.dataType === Query.ObjectDataType ? [].concat(this.data) : this.data;
      list.forEach(item => data.push(item));

      this.totalSize += list.length;

      // Index calculated above may shift after additional insertions.  This has
      // to be done after the above insertions have completed.
      list.forEach((item) => {
        this._triggerChange({
          type: 'insert',
          index: this.data.indexOf(item),
          target: item,
          query: this,
        });
      });
    }
  }

  _handleIdentityRemoveEvent(evt) {
    const removed = [];
    evt.identities.forEach((identity) => {
      const index = this._getIndex(identity.id);
      if (index !== -1) {
        if (identity.id === this._nextDBFromId) this._nextDBFromId = this._updateNextFromId(index);
        if (identity.id === this._nextServerFromId) this._nextServerFromId = this._updateNextFromId(index);
        removed.push({
          data: identity,
          index,
        });
        if (this.dataType === Query.ObjectDataType) {
          this.data = [
            ...this.data.slice(0, index),
            ...this.data.slice(index + 1),
          ];
        } else {
          this.data.splice(index, 1);
        }
      }
    });

    this.totalSize -= removed.length;
    removed.forEach((removedObj) => {
      this._triggerChange({
        type: 'remove',
        target: this._getData(removedObj.data),
        index: removedObj.index,
        query: this,
      });
    });
  }

  /**
   * If the current next-id is removed from the list, get a new nextId.
   *
   * If the index is greater than 0, whatever is after that index may have come from
   * websockets or other sources, so decrement the index to get the next safe paging id.
   *
   * If the index if 0, even if there is data, that data did not come from paging and
   * can not be used safely as a paging id; return '';
   *
   * @method _updateNextFromId
   * @param {number} index - Current index of the nextFromId
   * @returns {string} - Next ID or empty string
   */
  _updateNextFromId(index) {
    if (index > 0) return this.data[index - 1].id;
    else return '';
  }

  _triggerChange(evt) {
    this.trigger('change', evt);
    this.trigger('change:' + evt.type, evt);
  }
}


Query.prefixUUID = 'layer:///queries/';

/**
 * Query for Conversations.
 *
 * Use this value in the model property.
 * @type {string}
 * @static
 */
Query.Conversation = CONVERSATION;

/**
 * Query for Messages.
 *
 * Use this value in the model property.
 * @type {string}
 * @static
 */
Query.Message = MESSAGE;

/**
 * Query for Announcements.
 *
 * Use this value in the model property.
 * @type {string}
 * @static
 */
Query.Announcement = ANNOUNCEMENT;

/**
 * Query for Identities.
 *
 * Use this value in the model property.
 * @type {string}
 * @static
 */
Query.Identity = IDENTITY;

/**
 * Get data as POJOs/immutable objects.
 *
 * Your Query data and events will provide Messages/Conversations as objects.
 * @type {string}
 * @static
 */
Query.ObjectDataType = 'object';

/**
 * Get data as instances of layer.Message and layer.Conversation.
 *
 * Your Query data and events will provide Messages/Conversations as instances.
 * @type {string}
 * @static
 */
Query.InstanceDataType = 'instance';

/**
 * Set the maximum page size for queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSize = 100;

/**
 * Set the maximum page size for Identity queries.
 *
 * @type {number}
 * @static
 */
Query.MaxPageSizeIdentity = 500;

/**
 * Access the number of results currently loaded.
 *
 * @type {Number}
 */
Object.defineProperty(Query.prototype, 'size', {
  enumerable: true,
  get: function get() {
    return !this.data ? 0 : this.data.length;
  },
});

/** Access the total number of results on the server.
 *
 * Will be 0 until the first query has successfully loaded results.
 *
 * @type {Number}
 */
Query.prototype.totalSize = 0;


/**
 * Access to the client so it can listen to websocket and local events.
 *
 * @type {layer.Client}
 * @protected
 */
Query.prototype.client = null;

/**
 * Query results.
 *
 * Array of data resulting from the Query; either a layer.Root subclass.
 *
 * or plain Objects
 * @type {Object[]}
 */
Query.prototype.data = null;

/**
 * Specifies the type of data being queried for.
 *
 * Model is one of
 * * layer.Query.Conversation
 * * layer.Query.Message
 * * layer.Query.Announcement
 * * layer.Query.Identity
 *
 * @type {String}
 */
Query.prototype.model = '';

/**
 * What type of results to request of the server.
 *
 * Not yet supported; returnType is one of
 *
 * * object
 * * id
 * * count
 *
 * This Query API is designed only for use with 'object'.
 * @type {String}
 */
Query.prototype.returnType = 'object';

/**
 * Specify what kind of data array your application requires.
 *
 * Used to specify query dataType.  One of
 * * Query.ObjectDataType
 * * Query.InstanceDataType
 *
 * @type {String}
 */
Query.prototype.dataType = Query.InstanceDataType;

/**
 * Number of results from the server to request/cache.
 *
 * The pagination window can be increased to download additional items, or decreased to purge results
 * from the data property.
 *
 *     query.update({
 *       paginationWindow: 150
 *     })
 *
 * This call will load 150 results.  If it previously had 100,
 * then it will load 50 more. If it previously had 200, it will drop 50.
 *
 * Note that the server will only permit 100 at a time, so
 * setting a large pagination window may result in many
 * requests to the server to reach the specified page value.
 * @type {Number}
 */
Query.prototype.paginationWindow = 100;

/**
 * Sorting criteria for Conversation Queries.
 *
 * Only supports an array of one field/element.
 * Only supports the following options:
 *
 *     [{'createdAt': 'desc'}]
 *     [{'lastMessage.sentAt': 'desc'}]
 *
 * Why such limitations? Why this structure?  The server will be exposing a Query API at which point the
 * above sort options will make a lot more sense, and full sorting will be provided.
 *
 * @type {String}
 */
Query.prototype.sortBy = null;

/**
 * This value tells us what to reset the paginationWindow to when the query is redefined.
 *
 * @type {Number}
 * @private
 */
Query.prototype._initialPaginationWindow = 100;

/**
 * Your Query's WHERE clause.
 *
 * Currently, the only query supported is "conversation.id = 'layer:///conversations/uuid'"
 * Note that both ' and " are supported.
 * @type {string}
 */
Query.prototype.predicate = null;

/**
 * True if the Query is connecting to the server.
 *
 * It is not gaurenteed that every update(); for example, updating a paginationWindow to be smaller,
 * Or changing a value to the existing value would cause the request not to fire.
 * R ecommended pattern is:
 *
 *      query.update({paginationWindow: 50});
 *      if (!query.isFiring) {
 *        alert("Done");
 *      } else {
 *          query.on("change", function(evt) {
 *            if (evt.type == "data") alert("Done");
 *          });
 *      }
 *
 * @type {Boolean}
 */
Query.prototype.isFiring = false;

/**
 * True if we have reached the last result, and further paging will just return []
 *
 * @type {Boolean}
 */
Query.prototype.pagedToEnd = false;

/**
 * The last request fired.
 *
 * If multiple requests are inflight, the response
 * matching this request is the ONLY response we will process.
 * @type {String}
 * @private
 */
Query.prototype._firingRequest = '';

/**
 * Query is waiting for data from a syncing server
 *
 * @type {Boolean}
 * @private
 */
Query.prototype._isServerSyncing = false;

/**
 * The ID to use in paging the server.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the server.
 *
 * @type {string}
 */
Query.prototype._nextServerFromId = '';

/**
 * The ID to use in paging the database.
 *
 * Why not just use the ID of the last item in our result set?
 * Because as we receive websocket events, we insert and append items to our data.
 * That websocket event may not in fact deliver the NEXT item in our data, but simply an item, that sequentially
 * belongs at the end despite skipping over other items of data.  Paging should not be from this new item, but
 * only the last item pulled via this query from the database.
 *
 * @type {string}
 */
Query.prototype._nextDBFromId = '';


Query._supportedEvents = [
  /**
   * The query data has changed; any change event will cause this event to trigger.
   * @event change
   */
  'change',

  /**
   * A new page of data has been loaded from the server
   * @event 'change:data'
   */
  'change:data',

  /**
   * All data for this query has been reset due to a change in the Query predicate.
   * @event 'change:reset'
   */
  'change:reset',

  /**
   * An item of data within this Query has had a property change its value.
   * @event 'change:property'
   */
  'change:property',

  /**
   * A new item of data has been inserted into the Query. Not triggered by loading
   * a new page of data from the server, but is triggered by locally creating a matching
   * item of data, or receiving a new item of data via websocket.
   * @event 'change:insert'
   */
  'change:insert',

  /**
   * An item of data has been removed from the Query. Not triggered for every removal, but
   * is triggered by locally deleting a result, or receiving a report of deletion via websocket.
   * @event 'change:remove'
   */
  'change:remove',

  /**
   * The query data failed to load from the server.
   * @event error
   */
  'error',

  /**
   * The server needs to sync more data before it can provide the client all the requested data.
   *
   *     query.on('server-syncing-state', function(evt) {
   *       alert('syncing is ' + evt.syncing ? 'running' : 'completed');
   *     });
   *
   * Only occurs for querying Messages.  Comes with a parameter `syncing` set to true
   * when we are syncing, and false when done.
   * @event server-syncing-state
   */
  'server-syncing-state',
].concat(Root._supportedEvents);

Root.initClass.apply(Query, [Query, 'Query']);

module.exports = Query;
