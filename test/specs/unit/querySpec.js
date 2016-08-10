/*eslint-disable */
describe("The Query Class", function() {
    var appId = "Fred's App";

    var conversation, conversationUUID,
        conversation2,
        announcement,
        message,
        identity,
        client,
        requests;

    beforeEach(function() {
        jasmine.clock().install();
        jasmine.Ajax.install();
        requests = jasmine.Ajax.requests;
        client = new layer.Client({
            appId: appId,
            url: "https://huh.com"
        });
        client.sessionToken = "sessionToken";
        client.userId = "Frodo";
              client.user = new layer.Identity({
          clientId: client.appId,
          userId: client.userId,
          id: "layer:///identities/" + client.userId,
          firstName: "first",
          lastName: "last",
          phoneNumber: "phone",
          emailAddress: "email",
          metadata: {},
          publicKey: "public",
          avatarUrl: "avatar",
          displayName: "display",
          syncState: layer.Constants.SYNC_STATE.SYNCED,
          isFullIdentity: true,
          sessionOwner: true
        });


        client._clientAuthenticated();
        getObjectsResult = [];
        spyOn(client.dbManager, "getObjects").and.callFake(function(tableName, ids, callback) {
            setTimeout(function() {
                callback(getObjectsResult);
            }, 10);
        });
        client._clientReady();
        client.onlineManager.isOnline = true;

        identity = client._createObject(responses.useridentity);
        conversation = client._createObject(responses.conversation1);
        announcement = client._createObject(responses.announcement);
        conversation2 = client._createObject(responses.conversation2);
        message = conversation.createMessage("Hey");

        jasmine.clock().tick(1);
        requests.reset();
        client.syncManager.queue = [];
    });

    afterEach(function() {
        client.destroy();
        jasmine.Ajax.uninstall();
        jasmine.clock().uninstall();
    });

    afterAll(function() {
        layer.Client.destroyAllClients();
    });

    describe("The constructor() method", function() {
        it("Should accept an object as input", function() {
            expect(new layer.Query({
                client: client,
                model: "Conversation"
            }).model).toEqual("Conversation");

            expect(new layer.Query({
                client: client,
                returnType: "count"
            }).returnType).toEqual("count");

            expect(new layer.Query({
                client: client,
                dataType: "object"
            }).dataType).toEqual("object");
        });

        it("Should accept a QueryBuilder input", function() {
            var builder = layer.QueryBuilder.conversations().paginationWindow(15);
            var query = new layer.Query(client, builder);
            expect(query.paginationWindow).toEqual(15);
        });

        it("Should initialize data", function() {
            expect(new layer.Query({
                client: client,
                dataType: "object"
            }).data).toEqual([]);
        });

        it("Should require a client", function() {
            expect(function() {
                new layer.Query({});
            }).toThrowError(layer.LayerError.dictionary.clientMissing);
        });

        it("Should call _run if isReady", function() {
            // Setup
            var tmp = layer.Query.prototype._run;
            spyOn(layer.Query.prototype, "_run");

            // Run
            var query = new layer.Query({
                client: client
            });

            // Posttest
            expect(layer.Query.prototype._run).toHaveBeenCalledWith();

            // Restore
            layer.Query.prototype._run = tmp;;
        });

        it("Should call _run WHEN isReady", function() {
            // Setup
            var tmp = layer.Query.prototype._run;
            spyOn(layer.Query.prototype, "_run");
            client.isReady = false;

            // Run
            var query = new layer.Query({
                client: client
            });

            // Midtest
            expect(layer.Query.prototype._run).not.toHaveBeenCalled();

            // Run some more
            client.trigger('ready');

            // Posttest
            expect(layer.Query.prototype._run).toHaveBeenCalledWith();

            // Restore
            layer.Query.prototype._run = tmp;
        });

        // Integration test verifies that new Conversation in the Client
        // triggers _handleConversationEvents in Query
        it("Should setup change event handlers", function() {
            var query = new layer.Query({
                client: client,
                model: layer.Query.Conversation
            });
            spyOn(query, "_handleConversationEvents");

            // Run
            client.trigger("conversations:add", {conversations: [conversation]});

            // Posttest
            expect(query._handleConversationEvents).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));
        });

        it("Should force paginationWindow to acceptable value", function() {
          var query = new layer.Query({
            client: client,
            paginationWindow: 12345
          });
          expect(query.paginationWindow).toEqual(layer.Query.MaxPageSize);
        });

        it("Should accept a full predicate", function() {
          var query = new layer.Query({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
        });

        it("Should accept a UUID predicate", function() {
          var query = new layer.Query({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual('conversation.id = \'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf\'');
        });

        it("Should accept a full predicate double quote", function() {
          var query = new layer.Query({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual("conversation.id = 'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'");
        });

        it("Should accept a UUID predicate double quote", function() {
          var query = new layer.Query({
            client: client,
            model: layer.Query.Message,
            predicate: 'conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
          });
          expect(query.predicate).toEqual("conversation.id = 'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'");
        });

         it("Should reject predicate on Conversations", function() {
            expect(function() {
                var query = new layer.Query({
                    client: client,
                    model: layer.Query.Conversation,
                    predicate: 'conversation.id  =    "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
                });
            }).toThrowError(layer.LayerError.dictionary.predicateNotSupported);
            expect(layer.LayerError.dictionary.predicateNotSupported.length > 0).toBe(true);
        });

        it("Should reject an invalid predicate", function() {
          expect(function() {
            var query = new layer.Query({
                client: client,
                model: layer.Query.Message,
                predicate: "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf-hey"
            });
          }).toThrowError(layer.LayerError.dictionary.invalidPredicate);
          expect(layer.LayerError.dictionary.invalidPredicate.length > 0).toBe(true);
        });
    });

    describe("The destroy() method", function() {
        it("Should call _removeQuery", function() {
            var query = new layer.Query({
                client: client
            });
            spyOn(client, "_removeQuery");

            // Run
            query.destroy();

            // Posttest
            expect(client._removeQuery).toHaveBeenCalledWith(query);
        });
    });

    describe("The update() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should update the paginationWindow", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({paginationWindow: 30});

            // Posttest
            expect(query.paginationWindow).toEqual(30);
            expect(query._reset).not.toHaveBeenCalled();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should not update the paginationWindow to more than MAX_PAGE_SIZE greater than current size", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");
            query.data = [conversation, conversation2];

            // Run
            query.update({paginationWindow: 500});

            // Posttest
            expect(query.paginationWindow).toEqual(layer.Query.MaxPageSize + query.data.length);
        });

        it("Should update the predicate", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({
                model: layer.Query.Message,
                predicate: 'conversation.id = "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
            });

            // Posttest
            expect(query.predicate).toEqual("conversation.id = 'layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf'");
            expect(query._reset).toHaveBeenCalledWith();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should detect predicate is the same", function() {
            query.update({
                model: layer.Query.Message,
                predicate: 'conversation.id = "layer:///conversations/fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'
            });
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({predicate: 'conversation.id    =   "fb068f9a-3d2b-4fb2-8b04-7efd185e77bf"'});

            // Posttest
            expect(query._reset).not.toHaveBeenCalledWith();
            expect(query._run).not.toHaveBeenCalledWith();
        });

        it("Should update the model", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({model: 'Message'});

            // Posttest
            expect(query.model).toEqual('Message');
            expect(query._reset).toHaveBeenCalledWith();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should update sortBy", function() {
            spyOn(query, "_reset");
            spyOn(query, "_run");

            // Run
            query.update({sortBy: [{'created_at': 'desc'}]});

            // Posttest
            expect(query.sortBy).toEqual([{'created_at': 'desc'}]);
            expect(query._reset).toHaveBeenCalledWith();
            expect(query._run).toHaveBeenCalledWith();
        });

        it("Should accept a Query Builder", function() {
            query.update(layer.QueryBuilder.conversations().paginationWindow(18));
            expect(query.paginationWindow).toEqual(18);
        });

    });

    describe("The _reset() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should clear the data", function() {
            query.data = [conversation];
            query._reset();
            expect(query.data).toEqual([]);
        });

        it("Should call _checkAndPurgeCache", function() {
            spyOn(client, "_checkAndPurgeCache");
            query.data = [conversation];
            query._reset();
            expect(client._checkAndPurgeCache).toHaveBeenCalledWith([conversation]);
        });

        it("Should reset paginationWindow", function() {
            query.paginationWindow = 5000;
            query._reset();
            expect(query.paginationWindow).toEqual(15);
        });


        it("Should reset pagination properties", function() {
           query._nextServerFromId = "hey";
           query._nextDBFromId = "ho";
           query._reset();
           expect(query._nextServerFromId).toEqual('');
           expect(query._nextDBFromId).toEqual('');
        });

        it("Should reset _predicate", function() {
            query._predicate = "hey";
            query._reset();
            expect(query._predicate).toEqual(null);
        });

        it("Should trigger a reset change", function() {
            spyOn(query, "_triggerChange");
            query._reset();
            expect(query._triggerChange).toHaveBeenCalledWith({data: [], type: 'reset'});
        });
    });

    describe("The reset() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _reset and _run", function() {
          spyOn(query, "_reset");
          spyOn(query, "_run");
          query.reset();
          expect(query._reset).toHaveBeenCalledWith();
          expect(query._run).toHaveBeenCalledWith();
        });
    });

    describe("The _run() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should decrease page size without firing any requests", function() {
            query.paginationWindow = 10;
            for (var i = 0; i < 20; i++) {
                query.data.push(client.createConversation({
                    participants: ["a"],
                    distinct: false
                }));
            }
            var data = query.data;
            spyOn(query, "_runConversation");
            spyOn(query, "_runMessage");
            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "_triggerAsync");

            // Run
            query._run();

            // Posttest
            expect(query.data.length).toEqual(10);
            expect(client._checkAndPurgeCache).toHaveBeenCalledWith(data.slice(10));
            expect(query._runConversation).not.toHaveBeenCalled();
            expect(query._runMessage).not.toHaveBeenCalled();
            expect(query._triggerAsync).toHaveBeenCalledWith("change", {data: []});
        });

        it("Should call _runConversation if the model is Conversation", function() {
            spyOn(query, "_runConversation");
            spyOn(query, "_runMessage");
            spyOn(query, "_runAnnouncement");
            spyOn(query, "_runIdentity");

            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [conversation];

            // Run
            query._run();

            // Posttest
            expect(client._checkAndPurgeCache).not.toHaveBeenCalled();
            expect(query._runConversation).toHaveBeenCalledWith(14);
            expect(query._runMessage).not.toHaveBeenCalled();
            expect(query._runAnnouncement).not.toHaveBeenCalled();
            expect(query._runIdentity).not.toHaveBeenCalled();
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should not call _runConversation if the model is Conversation and pagedToEnd", function() {
            spyOn(query, "_runConversation");
            spyOn(query, "_runMessage");
            spyOn(query, "_runAnnouncement");
            spyOn(query, "_runIdentity");

            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [conversation];
            query.pagedToEnd = true;

            // Run
            query._run();

            // Posttest
            expect(query._runConversation).not.toHaveBeenCalled();
        });

        it("Should call _runMessage if the model is Message", function() {
            query.model = "Message";
            query.predicate = 'conversation.id = "fred"';
            spyOn(query, "_runConversation");
            spyOn(query, "_runMessage");
            spyOn(query, "_runAnnouncement");
            spyOn(query, "_runIdentity");
            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [message];

            // Run
            query._run();

            // Posttest
            expect(client._checkAndPurgeCache).not.toHaveBeenCalled();
            expect(query._runMessage).toHaveBeenCalledWith(14);
            expect(query._runAnnouncement).not.toHaveBeenCalled();
            expect(query._runConversation).not.toHaveBeenCalled();
            expect(query._runIdentity).not.toHaveBeenCalled();
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should call _runAnnouncement if the model is Announcement", function() {
            query.model = layer.Query.Announcement;
            spyOn(query, "_runConversation");
            spyOn(query, "_runMessage");
            spyOn(query, "_runAnnouncement");
            spyOn(query, "_runIdentity");
            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [announcement];

            // Run
            query._run();

            // Posttest
            expect(client._checkAndPurgeCache).not.toHaveBeenCalled();
            expect(query._runMessage).not.toHaveBeenCalled()
            expect(query._runAnnouncement).toHaveBeenCalledWith(14);
            expect(query._runConversation).not.toHaveBeenCalled();
            expect(query._runIdentity).not.toHaveBeenCalled();
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should call _runIdentity if the model is Identity", function() {
            query.model = layer.Query.Identity;
            spyOn(query, "_runConversation");
            spyOn(query, "_runMessage");
            spyOn(query, "_runAnnouncement");
            spyOn(query, "_runIdentity");
            spyOn(client, "_checkAndPurgeCache");
            spyOn(query, "trigger");
            query.data = [identity];

            // Run
            query._run();

            // Posttest
            expect(client._checkAndPurgeCache).not.toHaveBeenCalled();
            expect(query._runMessage).not.toHaveBeenCalled()
            expect(query._runAnnouncement).not.toHaveBeenCalled();
            expect(query._runConversation).not.toHaveBeenCalled();
            expect(query._runIdentity).toHaveBeenCalledWith(14);
            expect(query.trigger).not.toHaveBeenCalled();
        });


        it("Should do nothing if there are no more results requested", function() {
            for (var i = 0; i < 50; i++) query.data.push(message);
            query.paginationWindow = 50;
            spyOn(query, "_runConversation");
            query._run();
            expect(query._runConversation).not.toHaveBeenCalled();

            // cleanup
            query.data = [];
        });
    });

    describe("The _runConversation() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true", function() {
            query.isFiring = false;
            query._runConversation();
            expect(query.isFiring).toBe(true);
        });

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._runConversation(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations?sort_by=created_at&page_size=32");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._runConversation(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations?sort_by=created_at&page_size=32&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadConversations");

          // Test 1
          query._runConversation(17);
          expect(client.dbManager.loadConversations).toHaveBeenCalledWith('created_at', '', 17, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._runConversation(17);
          expect(client.dbManager.loadConversations).toHaveBeenCalledWith('created_at', 'howdy', 17, jasmine.any(Function));
        });

        it("Should refuse to call if already firing with same url", function() {
            requests.reset();
            query._runConversation(45);
            query._runConversation(45);
            expect(requests.count()).toEqual(1);
        });

        it("Should call with last_message sorting", function() {
            query.sortBy = [{'lastMessage.sentAt': 'desc'}];
            query._runConversation(32);
            expect(requests.mostRecent().url).toEqual(client.url + "/conversations?sort_by=last_message&page_size=32");
        });

        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._runConversation(36);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
                data: [{id: "a"}, {id: "b"}]
            }), "conversations?sort_by=created_at&page_size=36", 36);
        });
    });

    describe("The _getConversationPredicateIds() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return a UUID from a single quoted Full predicate", function() {
          query.predicate = 'conversation.id = "' + conversation.id + '"'
          expect(query._getConversationPredicateIds()).toEqual({
            uuid: conversation.id.replace(/layer\:\/\/\/conversations\//, ""),
            id: conversation.id
          });
        });

        it("Should return a undefined from an unquoted predicate", function() {
          query.predicate = 'conversation.id = ' + conversation.id;
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });

        it("Should return a undefined from an arbitrarty predicate", function() {
          query.predicate = 'Frodo is a Dodo';
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });

        it("Should return a undefined from an empty predicate", function() {
          query.predicate = 'Frodo is a Dodo';
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });

        it("Should return a undefined from an predicate whose substring looks right", function() {
          query.predicate = 'conversation.id = "' + conversation.id + '" Frodo is a Dodo';
          expect(query._getConversationPredicateIds()).toBe(undefined);
        });
    });

    describe("The _runAnnouncement() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = new layer.Query({
                client: client,
                model: layer.Query.Announcement,
                paginationWindow: 15
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true", function() {
            query.isFiring = false;
            query._runAnnouncement(37);
            expect(query.isFiring).toBe(true);
        });

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._runAnnouncement(140);
            expect(requests.mostRecent().url).toEqual(client.url + "/announcements?page_size=140");

            // Test 2
            query._nextServerFromId = "howdy";
            query._runAnnouncement(140);
            expect(requests.mostRecent().url).toEqual(client.url + "/announcements?page_size=140&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadAnnouncements");

          // Test 1
          query._runAnnouncement(141);
          expect(client.dbManager.loadAnnouncements).toHaveBeenCalledWith('', 141, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._runAnnouncement(141);
          expect(client.dbManager.loadAnnouncements).toHaveBeenCalledWith('howdy', 141, jasmine.any(Function));
        });

        it("Should refuse to call if already firing with same url", function() {
            query.data = [];
            query._runAnnouncement(45);
            query._runAnnouncement(45);
            expect(requests.count()).toEqual(1);
        });


        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._runAnnouncement(47);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
                data: [{id: "a"}, {id: "b"}]
            }), "announcements?page_size=47", 47);
        });
    });

    describe("The _runMessage() method", function() {
        var query;
        beforeEach(function() {
            client._conversationsHash[conversation.id] = conversation;
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true if _getConversationPredicateIds returns an id", function() {
            spyOn(query, "_getConversationPredicateIds").and.returnValue({
              uuid: conversation.id.replace(/^layer\:\/\/\/conversations\//,''),
              id: conversation.id
            });
            query.isFiring = false;
            query._runMessage(37);
            expect(query.isFiring).toBe(true);
        });

        it("Should set isFiring to false if _getConversationPredicateIds returns undefined", function() {
            spyOn(query, "_getConversationPredicateIds").and.returnValue(undefined);
            query.isFiring = false;
            query._runMessage(37);
            expect(query.isFiring).toBe(false);
        });

        it("Should do nothing if no predicate", function() {
            query.isFiring = false;
            query.predicate = '';
            query._predicate = '';
            query._runMessage(39);
            expect(query.isFiring).toBe(false);
        });

        it("Should update _predicate", function() {
            query.isFiring = false;
            query.predicate = 'conversation.id = "' + conversation.id + '"';
            query._predicate = '';
            query._runMessage(40);
            expect(query._predicate).toEqual(conversation.id);
        });


        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._runMessage(140);
            expect(requests.mostRecent().url).toEqual(client.url + conversation.id.replace(/layer\:\/\//, "") + "/messages?page_size=140");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._runMessage(140);
            expect(requests.mostRecent().url).toEqual(client.url + conversation.id.replace(/layer\:\/\//, "") + "/messages?page_size=140&from_id=howdy");
        });

        it("Should call DB with _nextDBFromId", function() {
          spyOn(client.dbManager, "loadMessages");

          // Test 1
          query._runMessage(141);
          expect(client.dbManager.loadMessages).toHaveBeenCalledWith(conversation.id, '', 141, jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._runMessage(141);
          expect(client.dbManager.loadMessages).toHaveBeenCalledWith(conversation.id, 'howdy', 141, jasmine.any(Function));
        });


        it("Should refuse to call if already firing with same url", function() {
            var m1 = new layer.Message({
                client: client,
                fromServer: responses.message1,
            });
            var m2 = new layer.Message({
                client: client,
                fromServer: responses.message2,
            });
            requests.reset();

            conversation.lastMessage = conversation.createMessage("hi");
            query.data = [m1, m2];
            query._runMessage(45);
            query._runMessage(45);
            expect(requests.count()).toEqual(1);
        });

        it("Should refuse to call if Conversation unsaved", function() {
            var m1 = new layer.Message({
                client: client,
                fromServer: responses.message1,
            });
            var m2 = new layer.Message({
                client: client,
                fromServer: responses.message2,
            });
            requests.reset();

            conversation.lastMessage = conversation.createMessage("hi");
            conversation.syncState = layer.Constants.SYNC_STATE.SAVING;
            query.data = [m1, m2];
            query._runMessage(45);
            expect(requests.count()).toEqual(0);
        });


        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._runMessage(47);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
                data: [{id: "a"}, {id: "b"}]
            }), "conversations/" + conversation.id.replace(/^layer\:\/\/\/conversations\//, "") + "/messages?page_size=47", 47);
        });

        it("Should add lastMessage to the results", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._runMessage(48);

            // Posttest
            expect(query.data).toEqual([conversation.lastMessage]);
            expect(query._triggerChange).toHaveBeenCalledWith({
              type: 'data',
              data: conversation.lastMessage,
              query: query,
              target: client,
            });

        });
    });

    describe("The _runIdentity() method", function() {
        var query;
        beforeEach(function() {
            var tmp = layer.Query.prototype._run;
            layer.Query.prototype._run = function() {}
            query = new layer.Query({
                client: client,
                model: layer.Query.Identity,
                paginationWindow: 15
            });
            layer.Query.prototype._run = tmp;
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should set isFiring to true", function() {
            query.isFiring = false;
            query._runIdentity(37);
            expect(query.isFiring).toBe(true);
        });

        it("Should call database unless there is a _nextDBFromId", function() {
          spyOn(client.dbManager, "loadIdentities");

          // Test 1
          query._runIdentity(140);
          expect(client.dbManager.loadIdentities).toHaveBeenCalledWith(jasmine.any(Function));

          // Test 2
          query._nextDBFromId = 'howdy';
          query._runIdentity(141);
          expect(client.dbManager.loadIdentities.calls.count()).toEqual(1);
        });

        it("Should call server with _nextServerFromId", function() {
            // Test 1
            query._runIdentity(141);
            expect(requests.mostRecent().url).toEqual(client.url + "/identities?page_size=141");

            // Test 2
            query._nextServerFromId = 'howdy';
            query._runIdentity(140);
            expect(requests.mostRecent().url).toEqual(client.url + "/identities?page_size=140&from_id=howdy");
        });

        it("Should refuse to call if already firing with same url", function() {
            query.data = [];
            query._runIdentity(45);
            query._runIdentity(45);
            expect(requests.count()).toEqual(1);
        });


        it("Should call _processRunResults", function() {
            spyOn(query, "_processRunResults");
            query._runIdentity(47);
            requests.mostRecent().response({
                status: 200,
                responseText: JSON.stringify([{id: "a"}, {id: "b"}])
            });
            expect(query._processRunResults).toHaveBeenCalledWith(jasmine.objectContaining({
                success: true,
                data: [{id: "a"}, {id: "b"}]
            }), "identities?page_size=47", 47);
        });
    });

    describe("The _processRunResults() method", function() {
        var query, requestUrl;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                predicate: 'conversation.id = "' + conversation.id + '"'
            });
            requestUrl = client.url + "/" + query._firingRequest;
            query._firingRequest = requestUrl;
            query.isFiring = true;
        });

        afterEach(function() {
            query.destroy();
        });


        it("Should set isFiring to false if success", function() {
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 10);
            expect(query.isFiring).toBe(false);
        });

        it("Should set isFiring to false if failure", function() {
            query._processRunResults({
                success: false,
                data: [],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 10);
            expect(query.isFiring).toBe(false);
        });

        it("Should call _appendResults", function() {
            spyOn(query, "_appendResults");
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            }, requestUrl, 10);
            expect(query._appendResults).toHaveBeenCalledWith({
                success: true,
                data: [{id: "a"}],
                xhr: jasmine.any(Object)
            }, false);
        });

        it("Should not schedule _run if results are up to date", function() {
            spyOn(query, "_run");
            spyOn(query, "_appendResults");
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            }, requestUrl, 10);
            jasmine.clock().tick(10000);
            expect(query._run).not.toHaveBeenCalled();
            query.data = [];
        });

        it("Should schedule _run if results are not up to date", function() {
            spyOn(query, "_run");
            spyOn(query, "_appendResults");
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'true';
                    }
                }
            }, requestUrl, 10);
            jasmine.clock().tick(10000);
            expect(query._run).toHaveBeenCalled();
            query.data = [];
        });

        it("Should trigger server-syncing-state true if scheduling _run for the first time", function() {
            spyOn(query, "_run");
            spyOn(query, "trigger");
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                     getResponseHeader: function(name) {
                         if (name == 'Layer-Count') return 0;
                         if (name == 'Layer-Conversation-Is-Syncing') return 'true';
                     }
                }
            }, requestUrl, 10);
            expect(query.trigger).toHaveBeenCalledWith('server-syncing-state', { syncing: true });
        });

        it("Should NOT trigger server-syncing-state true if scheduling _run for subsequent calls", function() {
            spyOn(query, "_run");
            spyOn(query, "trigger");
            query._isServerSyncing = true;
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                     getResponseHeader: function(name) {
                         if (name == 'Layer-Count') return 0;
                         if (name == 'Layer-Conversation-Is-Syncing') return 'true';
                     }
                }
            }, requestUrl, 10);
            expect(query.trigger).not.toHaveBeenCalledWith('server-syncing-state', jasmine.any(Object));
        });

        it("Should trigger server-syncing-state false if sufficient data", function() {
            spyOn(query, "_run");
            spyOn(query, "trigger");
            query._isServerSyncing = true;
            query.paginationWindow = 4;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                     getResponseHeader: function(name) {
                         if (name == 'Layer-Count') return 0;
                         if (name == 'Layer-Conversation-Is-Syncing') return 'true';
                     }
                }
            }, requestUrl, 10);
            expect(query.trigger).toHaveBeenCalledWith('server-syncing-state', { syncing: false });
        });

        it("Should trigger server-syncing-state false if server is done syncing", function() {
            spyOn(query, "_run");
            spyOn(query, "trigger");
            query._isServerSyncing = true;
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                     getResponseHeader: function(name) {
                         if (name == 'Layer-Count') return 0;
                         if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                     }
                }
            }, requestUrl, 10);
            expect(query.trigger).toHaveBeenCalledWith('server-syncing-state', { syncing: false });
        });

        it("Should not trigger server-syncing-state false if server is not syncing", function() {
            spyOn(query, "_run");
            spyOn(query, "trigger");
            query.paginationWindow = 100;
            query.data = [message, message, message, message, message, message, message];
            query._processRunResults({
                success: true,
                data: [],
                xhr: {
                     getResponseHeader: function(name) {
                         if (name == 'Layer-Count') return 0;
                         if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                     }
                }
            }, requestUrl, 10);
            expect(query.trigger).not.toHaveBeenCalledWith('server-syncing-state', { syncing: false });
        });

        it("Should not call _appendResults if request is not the most recent request", function() {
            spyOn(query, "_appendResults");
            query._firingRequest = 'fred';
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {}
            }, 'joe', 10);
            expect(query._appendResults).not.toHaveBeenCalled();
        });

        it("Should not call _appendResults if isDestroyed", function() {
            spyOn(query, "_appendResults");
            query.isDestroyed = true;
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {}
            }, 'joe', 10);
            expect(query._appendResults).not.toHaveBeenCalled();

            // Cleanup
            query.isDestroyed = false;
        });

        it("Should not clear isFiring or _firingRequest if request is not the most recent request", function() {
            spyOn(query, "_appendResults");
            query._firingRequest = 'fred';
            query.isFiring = true;
            query._processRunResults({
                success: true,
                data: [{id: "a"}],
                xhr: {}
            }, 'joe', 10);
            expect(query.isFiring).toBe(true);
            expect(query._firingRequest).toEqual('fred');
        });

        it("Should set the totalSize property", function() {
             query._processRunResults({
                success: true,
                data: [responses.message1],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 10);
            expect(query.totalSize).toEqual(6);
        });

        it("Should not set pagedToEnd if the number of requested results is returned", function() {
             query._processRunResults({
                success: true,
                data: [responses.message1, responses.message1, responses.message1, responses.message1],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 4);
            expect(query.pagedToEnd).toBe(false);
        });

        it("Should set pagedToEnd if less than the number of requested results is returned", function() {
             query._processRunResults({
                success: true,
                data: [responses.message1, responses.message1, responses.message1],
                xhr: {
                    getResponseHeader: function() {return 6;},
                }
            }, requestUrl, 4);
            expect(query.pagedToEnd).toBe(true);
        });
    });

    describe("The _appendResults() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should register new results", function() {
            spyOn(client, "_createObject");
            spyOn(client, "_getObject").and.returnValue(conversation);
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            });
            expect(client._createObject).toHaveBeenCalledWith(responses.conversation2);
        });

        it("Should update _nextDBFromId if there is data from DB", function() {
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            }, true);
            expect(query._nextDBFromId).toEqual(responses.conversation2.id);
            expect(query._nextServerFromId).toEqual('');
        });

        it("Should update _nextServerFromId if there is data from Server", function() {
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            }, false);
            expect(query._nextServerFromId).toEqual(responses.conversation2.id);
            expect(query._nextDBFromId).toEqual('');
        });

        it("Should not update _nextXXXFromId if there is no data", function() {
            query._appendResults({data: []}, false);
            query._appendResults({data: []}, true);
            expect(query._nextServerFromId).toEqual('');
            expect(query._nextDBFromId).toEqual('');
        });

        it("Should replace the data if dataType is object", function() {
            query.dataType = "object";
            var oldData = query.data = [conversation];
            conversation.createdAt.setHours(conversation.createdAt.getHours() + 1);

            // Run
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            });

            // Posttest
            expect(query.data).not.toBe(oldData);
            expect(query.data).toEqual([
                jasmine.objectContaining({
                    id: conversation.id
                }),
                jasmine.objectContaining({
                    id: responses.conversation2.id
                })
            ]);
        });

        it("Should update the data if dataType is instance", function() {
            query.dataType = "instance";
            var oldData = query.data = [conversation];

            // Run
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            });

            // Posttest
            expect(query.data).toBe(oldData);
            expect(query.data).toEqual([jasmine.any(layer.Conversation), jasmine.any(layer.Conversation)]);
        });

        it("Should put objects rather than instances if dataType is object", function() {
            query.dataType = "object";
            query._appendResults({
                data: [JSON.parse(JSON.stringify(responses.conversation2))],
                xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
            });
            expect(query.data[0] instanceof layer.Conversation).toBe(false);
        });

        it("Should use _getInsertConversationIndex to position result", function() {
          var c1 = client.createConversation({ participants: ["a", "b", "c"] });
          var c2 = client.createConversation({ participants: ["b", "c", "d"] });
          var c3 = JSON.parse(JSON.stringify(responses.conversation2));
          c3.id += "f";
          c1.createdAt = new Date("2010-10-10");
          c2.createdAt = new Date("2010-10-8");
          c3.created_at = new Date("2010-10-9");
          query.data = [c1.toObject(), c2.toObject()];
          query.dataType = "object";
          spyOn(query, "_getInsertConversationIndex").and.callFake(function(conversation, data) {
            expect(conversation).toBe(client.getConversation(c3.id));
            expect(data).toEqual([c1.toObject(), c2.toObject()]);
          }).and.returnValue(1);

          // Run
          query._appendResults({
              data: [c3],
              xhr: {
                getResponseHeader: function(name) {
                    if (name == 'Layout-Count') return 6;
                    if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                }
            }
          });

          // Posttest
          expect(query._getInsertConversationIndex).toHaveBeenCalled();
          expect(query.data).toEqual([c1.toObject(), client.getConversation(c3.id).toObject(), c2.toObject()]);
        });

        it("Should use _getInsertMessageIndex to position result", function() {
          var m1 = conversation.createMessage("a");
          var m2 = conversation.createMessage("b");
          m1.position = 10;
          m2.position = 5;
          var m3 = JSON.parse(JSON.stringify(responses.message1));
          m3.conversation.id = conversation.id;
          m3.position = 8;
          query.data = [m1.toObject(), m2.toObject()];
          query.dataType = "object";
          query.model = layer.Query.Message;
          spyOn(query, "_getInsertMessageIndex").and.callFake(function(conversation, data) {
            expect(conversation).toBe(client.getMessage(m3.id));
            expect(data).toEqual([m1.toObject(), m2.toObject()]);
          }).and.returnValue(1);

          // Run
          query._appendResults({
              data: [m3],
              xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
          });

          // Posttest
          expect(query._getInsertMessageIndex).toHaveBeenCalled();
          expect(query.data).toEqual([m1.toObject(), client.getMessage(m3.id).toObject(), m2.toObject()]);
        });

        it("Should use last index to position result", function() {
          var i1 = client._createObject({
            id: "layer:///identities/1",
            user_id: "1",
            display_name: "1"
          });
          var i2 = client._createObject({
            id: "layer:///identities/2",
            user_id: "2",
            display_name: "2"
          });
          var i3 = client._createObject({
            id: "layer:///identities/3",
            user_id: "3",
            display_name: "3"
          });

          query.data = [i1.toObject(), i2.toObject()];
          query.dataType = "object";
          query.model = layer.Query.Identity;

          // Run
          query._appendResults({
              data: [i3],
              xhr: {
                    getResponseHeader: function(name) {
                        if (name == 'Layout-Count') return 6;
                        if (name == 'Layer-Conversation-Is-Syncing') return 'false';
                    }
                }
          });

          // Posttest
          expect(query.data).toEqual([i1.toObject(), i2.toObject(), i3.toObject()]);
        });
    });

    describe("The _getData() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return itself if dataType is instance", function() {
            query.dataType = "instance";
            expect(query._getData(conversation)).toBe(conversation);
        });

        it("Should return an Object if dataType is object", function() {
            query.dataType = "object";
            expect(query._getData(conversation)).not.toBe(conversation);
            expect(query._getData(conversation).id).toEqual(conversation.id);
            expect(query._getData(conversation) instanceof layer.Conversation).toBe(false);
        });
    });

    describe("The _getInstance() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return itself if its an instance", function() {
            expect(query._getInstance(conversation)).toBe(conversation);
        });

        it("Should return an instance if its an object", function() {
            expect(query._getInstance({id:conversation.id})).toBe(conversation);
        });
    });

    describe("The _getItem() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
            query.data = [conversation];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return a Message if Model is Message and Message is found", function() {
            // Setup
            var m = conversation.createMessage("Hi");
            query.data = [m];
            query.model = "Message";

            expect(query._getItem(m.id)).toBe(m);
        });

        it("Should return null if Model is Message and Message is not found", function() {
            // Setup
            var m = conversation.createMessage("Hi");
            query.data = [m];
            query.model = "Message";

            expect(query._getItem(m.id + "1")).toBe(null);
        });

        it("Should return a Conversation if Model is Conversation and Conversation is found", function() {
            expect(query._getItem(conversation.id)).toBe(conversation);
        });

        it("Should return null if Model is Conversation and Conversation is not found", function() {
            expect(query._getItem(conversation.id + "1")).toBe(null);
        });

        it("Should return a Message if Model is Conversation and lastMessage is found", function() {
            var m = conversation.createMessage("Hi");
            conversation.lastMessage = m;
            expect(query._getItem(m.id)).toBe(m);
        });

        it("Should return null if Model is Conversation and lastMessage is not found", function() {
            var m = conversation.createMessage("Hi");
            conversation.lastMessage = m;
            expect(query._getItem(m.id + "1")).toBe(null);
        });

        it("Should return an Announcement if Model is Announcement and Announcement is found", function() {
            // Setup
            query.data = [announcement];
            query.model = "Announcement";

            expect(query._getItem(announcement.id)).toBe(announcement);
        });

        it("Should return null if Model is Announcement and Announcement is not found", function() {
            // Setup
            query.data = [announcement];
            query.model = "Announcement";

            expect(query._getItem(announcement.id + "1")).toBe(null);
        });

        it("Should return an Identity if Model is Identity and Identity is found", function() {
            // Setup
            query.data = [identity];
            query.model = "Identity";

            expect(query._getItem(identity.id)).toBe(identity);
        });

        it("Should return null if Model is Identity and Identity is not found", function() {
            // Setup
            query.data = [identity];
            query.model = "Identity";

            expect(query._getItem(identity.id + "1")).toBe(null);
        });
    });

    describe("The _getIndex() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
            query.data = [conversation];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should return the index of a matching ID", function() {
            expect(query._getIndex(conversation.id)).toBe(0);
        });

        it("Should return -1 if not found", function() {
            expect(query._getIndex(conversation.id + "1")).toBe(-1);
        });
    });

    describe("The _handleChangeEvents() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
            query.data = [conversation];
            spyOn(query, "_handleConversationEvents");
            spyOn(query, "_handleMessageEvents");
            spyOn(query, "_handleIdentityEvents");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleConversationEvents", function() {
            query.model = "Conversation";
            query._handleChangeEvents("evtName", {a: "b"});
            expect(query._handleConversationEvents).toHaveBeenCalledWith({a: "b"});
            expect(query._handleMessageEvents).not.toHaveBeenCalled();
            expect(query._handleIdentityEvents).not.toHaveBeenCalled();
        });

        it("Should call _handleMessageEvents", function() {
            query.model = "Message";
            query._handleChangeEvents("evtName", {a: "b"});
            expect(query._handleMessageEvents).toHaveBeenCalledWith({a: "b"});
            expect(query._handleConversationEvents).not.toHaveBeenCalled();
            expect(query._handleIdentityEvents).not.toHaveBeenCalled();
        });

        it("Should call _handleIdentityEvents", function() {
            query.model = "Identity";
            query._handleChangeEvents("evtName", {a: "b"});
            expect(query._handleMessageEvents).not.toHaveBeenCalled();
            expect(query._handleConversationEvents).not.toHaveBeenCalled();
            expect(query._handleIdentityEvents).toHaveBeenCalledWith({a: "b"});
        });
    });

    describe("The _handleIdentityEvents() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Identity',
                paginationWindow: 15
            });
            query.data = [identity];
            spyOn(query, "_handleIdentityChangeEvent");
            spyOn(query, "_handleIdentityAddEvent");
            spyOn(query, "_handleIdentityRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleIdentityChangeEvent", function() {
            query._handleIdentityEvents({a: "b", eventName: "identities:change"})
            expect(query._handleIdentityChangeEvent).toHaveBeenCalledWith({a: "b", eventName: "identities:change"});
            expect(query._handleIdentityAddEvent).not.toHaveBeenCalled();
            expect(query._handleIdentityRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleIdentityAddEvent", function() {
            query._handleIdentityEvents({a: "b", eventName: "identities:add"})
            expect(query._handleIdentityChangeEvent).not.toHaveBeenCalled();
            expect(query._handleIdentityAddEvent).toHaveBeenCalledWith({a: "b", eventName: "identities:add"});
            expect(query._handleIdentityRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleIdentityRemoveEvent", function() {
            query._handleIdentityEvents({a: "b", eventName: "identities:remove"})
            expect(query._handleIdentityChangeEvent).not.toHaveBeenCalled();
            expect(query._handleIdentityAddEvent).not.toHaveBeenCalled();
            expect(query._handleIdentityRemoveEvent).toHaveBeenCalledWith({a: "b", eventName: "identities:remove"});
        });
    });

    describe("The _handleConversationEvents() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15
            });
            query.data = [conversation];
            spyOn(query, "_handleConversationChangeEvent");
            spyOn(query, "_handleConversationAddEvent");
            spyOn(query, "_handleConversationRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleConversationChangeEvent", function() {
            query._handleConversationEvents({a: "b", eventName: "conversations:change"})
            expect(query._handleConversationChangeEvent).toHaveBeenCalledWith({a: "b", eventName: "conversations:change"});
            expect(query._handleConversationAddEvent).not.toHaveBeenCalled();
            expect(query._handleConversationRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleConversationAddEvent", function() {
            query._handleConversationEvents({a: "b", eventName: "conversations:add"})
            expect(query._handleConversationChangeEvent).not.toHaveBeenCalled();
            expect(query._handleConversationAddEvent).toHaveBeenCalledWith({a: "b", eventName: "conversations:add"});
            expect(query._handleConversationRemoveEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleConversationRemoveEvent", function() {
            query._handleConversationEvents({a: "b", eventName: "conversations:remove"})
            expect(query._handleConversationChangeEvent).not.toHaveBeenCalled();
            expect(query._handleConversationAddEvent).not.toHaveBeenCalled();
            expect(query._handleConversationRemoveEvent).toHaveBeenCalledWith({a: "b", eventName: "conversations:remove"});
        });
    });

    describe("The _handleMessageEvents() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15
            });
            query.data = [conversation.createMessage("hey")];
            spyOn(query, "_handleMessageConvIdChangeEvent");
            spyOn(query, "_handleMessageChangeEvent");
            spyOn(query, "_handleMessageAddEvent");
            spyOn(query, "_handleMessageRemoveEvent");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleMessageChangeEvent", function() {
            query._handleMessageEvents({a: "b", eventName: "messages:change"})
            expect(query._handleMessageChangeEvent).toHaveBeenCalledWith({a: "b", eventName: "messages:change"});
            expect(query._handleMessageAddEvent).not.toHaveBeenCalled();
            expect(query._handleMessageRemoveEvent).not.toHaveBeenCalled();
            expect(query._handleMessageConvIdChangeEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleMessageAddEvent", function() {
            query._handleMessageEvents({a: "b", eventName: "messages:add"})
            expect(query._handleMessageChangeEvent).not.toHaveBeenCalled();
            expect(query._handleMessageAddEvent).toHaveBeenCalledWith({a: "b", eventName: "messages:add"});
            expect(query._handleMessageRemoveEvent).not.toHaveBeenCalled();
            expect(query._handleMessageConvIdChangeEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleMessageRemoveEvent", function() {
            query._handleMessageEvents({a: "b", eventName: "messages:remove"})
            expect(query._handleMessageChangeEvent).not.toHaveBeenCalled();
            expect(query._handleMessageAddEvent).not.toHaveBeenCalled();
            expect(query._handleMessageRemoveEvent).toHaveBeenCalledWith({a: "b", eventName: "messages:remove"});
            expect(query._handleMessageConvIdChangeEvent).not.toHaveBeenCalled();
        });

        it("Should call _handleMessageConvIdChangeEvent", function() {
            query._handleMessageEvents({a: "b", eventName: "conversations:change"})
            expect(query._handleMessageChangeEvent).not.toHaveBeenCalled();
            expect(query._handleMessageAddEvent).not.toHaveBeenCalled();
            expect(query._handleMessageRemoveEvent).not.toHaveBeenCalled();
            expect(query._handleMessageConvIdChangeEvent).toHaveBeenCalledWith({a: "b", eventName: "conversations:change"});
        });
    });

    describe("The _handleConversationChangeEvent() method", function() {
        describe("Sort by createdAt, dataType is object", function() {
            var query;
            beforeEach(function() {
                query = new layer.Query({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "object",
                    sortBy: [{'createdAt': 'desc'}]
                });
                query.data = [conversation2.toObject(), conversation.toObject()];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should find the Conversation and apply Conversation ID changes without reordering and using a new data array", function() {
                // Setup
                var id = conversation.id;
                var tempId = layer.Util.generateUUID();
                query.data[1].id = tempId;
                var data = query.data;
                conversation._clearObject();
                conversation.id = id;
                var evt = new layer.LayerEvent({
                    property: "id",
                    oldValue: tempId,
                    newValue: id,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1].id).toEqual(id);
                expect(data[1].id).toEqual(tempId);
            });

            it("Should update the array object and the conversation object for unreadCount change", function() {
                // Setup
                var data = query.data;
                var originalObject = data[1];
                originalObject.unreadCount = 1;
                conversation._clearObject();
                var evt = new layer.LayerEvent({
                    property: "unreadCount",
                    oldValue: 1,
                    newValue: 2,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1]).not.toEqual(originalObject);
            });

            it("Should update the array object but not reorder for lastMessage events", function() {
                // Setup
                var data = query.data;
                conversation._clearObject();
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data).toEqual(data);
            });

            it("Should not touch data array if dataType is object but item not in the data", function() {
                var conversation = client.createConversation({ participants: ["abc"] });
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;
                data[0].id += "1";

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).toBe(data);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation.toObject(),
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });
        });

        describe("Sort by createdAt, dataType is instance", function() {
            var query;
            beforeEach(function() {
                query = new layer.Query({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "instance",
                    sortBy: [{'createdAt': 'desc'}]
                });
                query.data = [conversation2, conversation];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should not touch data array for a participant change event", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).toEqual([conversation2, conversation]);
                expect(query.data).toBe(data);
            });

            it("Should not reorder the array for a lastMessage event", function() {
                // Setup
                var data = query.data;
                var dataCopy = [].concat(query.data);
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).toBe(data);
                expect(query.data).toEqual(dataCopy);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation,
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });
        });

        describe("Sort by lastMessage.sentAt, dataType is object", function() {
            var query;
            beforeEach(function() {
                query = new layer.Query({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "object",
                    sortBy: [{'lastMessage.sentAt': 'desc'}]
                });
                query.data = [conversation2.toObject(), conversation.toObject()];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should find the Conversation and apply Conversation ID changes but not reorder", function() {
                // Setup
                var id = conversation.id;
                var tempId = layer.Util.generateUUID();
                query.data[1].id = tempId;
                var data = query.data = [conversation2.toObject(), conversation.toObject()];
                conversation._clearObject();
                conversation.id = id;
                var evt = new layer.LayerEvent({
                    property: "id",
                    oldValue: tempId,
                    newValue: id,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data[1].id).toEqual(id);
                expect(data[1].id).toEqual(tempId);
                expect(query.data).toEqual([conversation2.toObject(), conversation.toObject()]);
            });

            it("Should update the array object and reorder for lastMessage events", function() {
                // Setup
                var data = query.data;
                conversation._clearObject();
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).not.toBe(data);
                expect(query.data).toEqual([conversation.toObject(), conversation2.toObject()]);
            });

            it("Should not touch data array if dataType is object but item not in the data", function() {
                var conversation = client.createConversation({ participants: ["abc"] });
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;
                data[0].id += "1";

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).toBe(data);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation.toObject(),
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });
        });

        describe("Sort by lastMessage.sentAt, dataType is instance", function() {
            var query;
            beforeEach(function() {
                query = new layer.Query({
                    client: client,
                    model: 'Conversation',
                    paginationWindow: 15,
                    dataType: "instance",
                    sortBy: [{'lastMessage.sentAt': 'desc'}]
                });
                query.data = [conversation2, conversation];
            });

            afterEach(function() {
                query.destroy();
            });

            it("Should not touch data array for a participant change event", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["abc"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                var data = query.data;

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).toEqual([conversation2, conversation]);
                expect(query.data).toBe(data);
            });

            it("Should reorder the array for a lastMessage event", function() {
                // Setup
                var data = query.data;
                var dataCopy = [].concat(query.data);
                var evt = new layer.LayerEvent({
                    property: "lastMessage",
                    oldValue: null,
                    newValue: message,
                    target: conversation
                }, "conversations:change");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.data).toBe(data);
                expect(query.data).toEqual([conversation, conversation2]);
            });

            it("Should trigger change event if the Conversation is in the data", function() {
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: conversation
                }, "conversations:change");
                spyOn(query, "_triggerChange");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query._triggerChange).toHaveBeenCalledWith({
                    type: "property",
                    target: conversation,
                    query: query,
                    isChange: true,
                    changes: [{
                        property: "participants",
                        oldValue: ["a"],
                        newValue: ["a", "b"]
                    }]
                });
            });

            it("Should not trigger change event if Conversation is NOT in the data", function() {
                var data = query.data;
                var evt = new layer.LayerEvent({
                    property: "participants",
                    oldValue: ["a"],
                    newValue: ["a", "b"],
                    target: {id: conversation.id + "1"}
                }, "conversations:change");
                spyOn(query, "trigger");

                // Run
                query._handleConversationChangeEvent(evt);

                // Posttest
                expect(query.trigger).not.toHaveBeenCalled();
            });
        });
    });

    describe("The _getInsertConversationIndex() method", function() {
        var query;
        beforeEach(function() {
            conversation.createdAt = 5;
            conversation2.createdAt = 10;
            conversation2.lastMessage.sentAt = 8;
            conversation.lastMessage.sentAt = 12;
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15,
                dataType: "object",
                sortBy: [{"createdAt": "desc"}]
            });
        });

        it("Should insert as first element if sort by createdAt", function() {
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 15;
            expect(query._getInsertConversationIndex(c, [conversation2, conversation])).toEqual(0);
        });

        it("Should insert as second element if sort by createdAt", function() {
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 8;
            expect(query._getInsertConversationIndex(c, [conversation2, conversation])).toEqual(1);
        });

        it("Should insert as last element if sort by createdAt", function() {
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 3;
            expect(query._getInsertConversationIndex(c, [conversation2, conversation])).toEqual(2);
        });

        it("Should insert as first element if sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 15;
            expect(query._getInsertConversationIndex(c, [conversation, conversation2])).toEqual(0);
        });

        it("Should insert as second element if sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 11;
            expect(query._getInsertConversationIndex(c, [conversation, conversation2])).toEqual(1);
        });

        it("Should insert as last element if sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 3;
            expect(query._getInsertConversationIndex(c, [conversation, conversation2])).toEqual(2);
        });

        it("Should use createdAt field in sort by lastMessage test 1", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 11;
            expect(query._getInsertConversationIndex(c, [conversation, conversation2])).toEqual(1);
        });

        it("Should use createdAt field in sort by lastMessage test 2", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["a"]});
            c.syncState = layer.Constants.SYNCED;
            c.createdAt = 11;
            data = [conversation, conversation2];
            data[0].createdAt = data[0].lastMessage.sentAt;
            delete data[0].lastMessage;
            expect(query._getInsertConversationIndex(c, data)).toEqual(1);
        });

        it("Should insert NEW items at top for sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [conversation, conversation2];
            expect(query._getInsertConversationIndex(c, data)).toEqual(0);
        });

        it("Should insert NEW items at top for sort by createdAt", function() {
            query.sortBy = [{"createdAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [conversation, conversation2];
            expect(query._getInsertConversationIndex(c, data)).toEqual(0);
        });

        it("Should insert added items after NEW items for sort by lastMessage", function() {
            query.sortBy = [{"lastMessage.sentAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [c, conversation2];
            expect(query._getInsertConversationIndex(conversation, data)).toEqual(1);
        });

        it("Should insert added items after NEW items for sort by createdAt", function() {
            query.sortBy = [{"createdAt": "desc"}];
            var c = client.createConversation({participants: ["layer:///identities/doh"]});
            data = [c, conversation2];
            expect(query._getInsertConversationIndex(conversation, data)).toEqual(2);
        });
    });

    describe("The _getInsertMessageIndex() method", function() {
        var query, message2;
        beforeEach(function() {
            message.position = 5;
            message2 = conversation.createMessage("hey");
            message2.position = 10;
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object"
            });
        });

        it("Should insert as first element if sort by position", function() {
            var m = {position: 15};
            expect(query._getInsertMessageIndex(m, [message2, message])).toEqual(0);
        });

        it("Should insert as second element if sort by position", function() {
            var c = {position: 8};
            expect(query._getInsertMessageIndex(c, [message2, message])).toEqual(1);
        });

        it("Should insert as last element if sort by position", function() {
            var c = {position: 3};
            expect(query._getInsertMessageIndex(c, [message2, message])).toEqual(2);
        });
    });

    describe("The _handleConversationAddEvent() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15,
                dataType: "object"
            });
            query.data = [conversation];
            spyOn(query, "_getInsertConversationIndex").and.returnValue(0);
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [];

            // Run
            query._handleConversationAddEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([conversation2.toObject(), conversation.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleConversationAddEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([conversation2, conversation]);
        });

        it("Should only operate on new values", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [conversation.toObject()];

            // Run
            query._handleConversationAddEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).toEqual([conversation2.toObject(), conversation.toObject()]);

        });

        it("Should trigger change event if new values", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [];
            spyOn(query, "trigger");

            // Run
            query._handleConversationAddEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.trigger).toHaveBeenCalledWith("change", {
                type: 'insert',
                index: 1,
                target: conversation.toObject(),
                query: query
            });
            expect(query.trigger).toHaveBeenCalledWith("change", {
                type: 'insert',
                index: 0,
                target: conversation2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");

            // Run
            query._handleConversationAddEvent({
                conversations: [conversation]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalSize property", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var data = query.data = [];
            expect(query.totalSize).toEqual(0);

            // Run
            query._handleConversationAddEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.totalSize).toEqual(2);
        });
    });

    describe("The _handleConversationRemoveEvent() method", function() {
        var query, conversation2;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Conversation',
                paginationWindow: 15,
                dataType: "object"
            });
            conversation2 = client.createConversation({ participants: ["cdc"] });
            query.data = [conversation.toObject(), conversation2.toObject()];

        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _updateNextFromId for db and server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextDBFromId = conversation.id;
            query._nextServerFromId = conversation2.id;

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('heyho');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should replace data with a new array removes conversations if dataType is object", function() {

            var data = query.data;

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var conversation3 = client.createConversation({ participants: ["zbd"] });

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation, conversation3]
            });

            // Posttest
            expect(query.data).toEqual([conversation2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: conversation.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: conversation2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [conversation2.toObject()];

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalSize property", function() {
            var conversation2 = client.createConversation({ participants: ["aza"] });
            var conversation3 = client.createConversation({ participants: ["azab"] });
            var data = query.data = [conversation, conversation2, conversation3];
            query.totalSize = 3;

            // Run
            query._handleConversationRemoveEvent({
                conversations: [conversation, conversation2]
            });

            // Posttest
            expect(query.totalSize).toEqual(1);
        });
    });

    describe("The _handleMessageConvIdChangeEvent() method", function() {
        var query;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should update the predicate if the old id matches", function() {
            var predicate = query.predicate;
            spyOn(query, "_run");

            // Run
            query._handleMessageConvIdChangeEvent(new layer.LayerEvent({
                property: "id",
                oldValue: conversation.id,
                newValue: conversation.id + "1",
                target: conversation
            }, "conversations:change"));

            // Posttest
            expect(query.predicate).not.toEqual(predicate);
            expect(query.predicate).toEqual("conversation.id = '" + conversation.id + "1'");
            expect(query._run).toHaveBeenCalled();
        });

        it("Should NOT update the predicate if the old id does not match", function() {
            var predicate = query.predicate;
            spyOn(query, "_run");

            // Run
            query._handleMessageConvIdChangeEvent(new layer.LayerEvent({
                property: "id",
                oldValue: conversation.id + "1",
                newValue: conversation.id,
                target: conversation
            }, "conversations:change"));

            // Posttest
            expect(query.predicate).toEqual(predicate);
            expect(query._run).not.toHaveBeenCalled();
        });
    });

    describe("The _handleMessagePositionChange() method", function() {
        var query, message, evt;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            message = conversation.createMessage("hi");
            query.data = [conversation.createMessage("hi 0"), message, conversation.createMessage("hi 2")];

            var oldPosition = 5;
            var newPosition = message.position = 15;
            evt = new layer.LayerEvent({
                property: "position",
                oldValue: oldPosition,
                newValue: newPosition,
                target: message
            }, "messages:change");
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should do nothing if index is -1", function() {
          // Setup
          spyOn(query, "_getInsertMessageIndex");

            // Run
          query._handleMessagePositionChange(evt, -1);

          // Posttest
          expect(query._getInsertMessageIndex).not.toHaveBeenCalled();
        });

        it("Should update data with the new index", function() {
          var data = query.data;
          spyOn(query, "_getInsertMessageIndex").and.returnValue(1);

          // Run
          query._handleMessagePositionChange(evt, 0);

          // Posttest
          expect(query.data).not.toBe(data);
          expect(query.data[0].id).toBe(message.id);
        });

        it("Should trigger a change event with the new index", function() {
          spyOn(query, "trigger");
          spyOn(query, "_getInsertMessageIndex").and.returnValue(1);

          // Run
          query._handleMessagePositionChange(evt, 0);

          // Posttest
          expect(query.trigger).toHaveBeenCalledWith('change', {
            type: 'property',
            target: query._getData(message),
            query: query,
            isChange: true,
            changes: evt.changes,
          });
        });

        it("Should return true with the new index", function() {
          spyOn(query, "_getInsertMessageIndex").and.returnValue(1);
          expect(query._handleMessagePositionChange(evt, 0)).toBe(true);
        });

        it("Should do none of the above if its the old index", function() {
          var data = query.data;
          spyOn(query, "trigger");
          spyOn(query, "_getInsertMessageIndex").and.returnValue(1);

          // Run
          expect(query._handleMessagePositionChange(evt, 1)).not.toBe(true);

          // Posttest
          expect(query.trigger).not.toHaveBeenCalled();
          expect(data).toBe(query.data);
        });
    });

    describe("The _handleMessageChangeEvent() method", function() {
        var query, message;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            message = conversation.createMessage("hi");
            query.data = [message];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should call _handleMessagePositionChange and make no changes if that method reports it handled everything", function() {
            // Setup
            var oldPosition =  5;
            var newPosition = message.position = 10;
            spyOn(query, "_handleMessagePositionChange").and.returnValue(true);
            var evt = new layer.LayerEvent({
                property: "position",
                oldValue: oldPosition,
                newValue: newPosition,
                target: message
            }, "messages:change");
            var data = query.data = [message.toObject()];

            // Run
            query._handleMessageChangeEvent(evt);

            // Posttest
            expect(query.data).toBe(data);
            expect(query._handleMessagePositionChange).toHaveBeenCalledWith(evt, 0);
        });


        it("Should not touch data array if dataType is object but item not in the data", function() {
            var evt = new layer.LayerEvent({
                property: "recipientStatus",
                oldValue: [{}],
                newValue: [{a: "read"}],
                target: message
            }, "messages:change");
            var data = query.data = [message.toObject()];
            data[0].id += "1"; // prevent data from being found

            // Run
            query._handleMessageChangeEvent(evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should update data array if dataType is instance", function() {
            // Setup
            query.dataType = "instance";
            var data = query.data = [message];
            var evt = new layer.LayerEvent({
                property: "recipientStatus",
                oldValue: [{}],
                newValue: [{a: "read"}],
                target: message
            }, "messages:change");

            // Run
            query._handleMessageChangeEvent(evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should trigger change event if the Message is in the data", function() {
            var data = query.data = [message.toObject()];
            var evt = new layer.LayerEvent({
                property: "recipientStatus",
                oldValue: [{}],
                newValue: [{a: "read"}],
                target: message
            }, "messages:change");
            spyOn(query, "_triggerChange");

            // Run
            query._handleMessageChangeEvent(evt);

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: "property",
                target: message.toObject(),
                query: query,
                isChange: true,
                changes: [{
                    property: "recipientStatus",
                    oldValue: [{}],
                    newValue: [{a: "read"}]
                }]
            });
        });

        it("Should not trigger change event if Message is NOT in the data", function() {
            var data = query.data = [message.toObject()];
            var evt = new layer.LayerEvent({
                property: "participants",
                oldValue: ["a"],
                newValue: ["a", "b"],
                target: {id: message.id + "1"}
            }, "messages:change");
            spyOn(query, "trigger");

            // Run
            query._handleMessageChangeEvent(evt);

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });
    });


    describe("The _handleMessageAddEvent() method", function() {
        var query, message1, message2;
        beforeEach(function() {
            message1 = conversation.createMessage("hi").send();
            message2 = conversation.createMessage("ho").send();
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            query.data = [];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var data = query.data = [];

            // Run
            query._handleMessageAddEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([message2.toObject(), message1.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleMessageAddEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([message2, message1]);
        });

        it("Should only operate on new values", function() {
            var data = query.data = [message1.toObject()];

            // Run
            query._handleMessageAddEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).toEqual([message2.toObject(), message1.toObject()]);

        });

        it("Should use _getInsertMessageIndex to position result", function() {
            spyOn(query, "_getInsertMessageIndex").and.callFake(function(arg1, arg2) {
              expect(arg1).toBe(message3);
              expect(arg2).toEqual([message1.toObject(), message2.toObject()]);
            }).and.returnValue(1);
            spyOn(query, "_handleChangeEvents");
            query.data = [message1.toObject(), message2.toObject()];
            message3 = conversation.createMessage("ho").send();

            // Run
            query._handleMessageAddEvent({
                messages: [message3]
            });

            // Posttest
            expect(query.data).toEqual([message1.toObject(), message3.toObject(), message2.toObject()]);
            expect(query._getInsertMessageIndex).toHaveBeenCalled();
        });

        it("Should trigger change event if new values", function() {
            var data = query.data = [];
            spyOn(query, "_triggerChange");

            // Run
            query._handleMessageAddEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 1,
                target: message1.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 0,
                target: message2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");
            query.data = [message1, message2];

            // Run
            query._handleMessageAddEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalCount property", function() {
          expect(query.totalSize).toEqual(0);

          // Run
          query._handleMessageAddEvent({
              messages: [message1, message2]
          });

          // Posttest
          expect(query.totalSize).toEqual(2);
        });
    });


    describe("The _handleMessageRemoveEvent() method", function() {
        var query, message1, message2;
        beforeEach(function() {
            message1 = conversation.createMessage("hi");
            message2 = conversation.createMessage("ho");
            query = new layer.Query({
                client: client,
                model: 'Message',
                paginationWindow: 15,
                dataType: "object",
                predicate: "conversation.id = '" + conversation.id + "'"
            });
            query.data = [message1.toObject(), message2.toObject()];

        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array without message if dataType is object", function() {

            var data = query.data;

            // Run
            query._handleMessageRemoveEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should call _updateNextFromId for db and server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextDBFromId = message1.id;
            query._nextServerFromId = message2.id;

            // Run
            query._handleMessageRemoveEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('heyho');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleMessageRemoveEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var message3 = conversation.createMessage("hi3");

            // Run
            query._handleMessageRemoveEvent({
                messages: [message1, message3]
            });

            // Posttest
            expect(query.data).toEqual([message2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleMessageRemoveEvent({
                messages: [message1, message2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: message1.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: message2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [message2.toObject()];

            // Run
            query._handleMessageRemoveEvent({
                messages: [message1]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should decrease the totalCount property", function() {
          query.data = [message, message1, message2];
          query.totalSize = 3;

          // Run
          query._handleMessageRemoveEvent({
              messages: [message1, message2]
          });

          // Posttest
          expect(query.totalSize).toEqual(1);
        });
    });




    describe("The _handleIdentityChangeEvent() method", function() {
        var query, identity2;
        beforeEach(function() {
            query = new layer.Query({
                client: client,
                model: 'Identity',
                paginationWindow: 15,
                dataType: "object"
            });
            identity2 = client._createObject(responses.useridentity);
            query.data = [identity];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should not touch data array if dataType is object but item not in the data", function() {
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");
            var data = query.data = [identity.toObject()];
            data[0].id += "1"; // prevent data from being found

            // Run
            query._handleIdentityChangeEvent(evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should not change the data array if dataType is instance", function() {
            // Setup
            query.dataType = "instance";
            var data = query.data = [identity];
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");

            // Run
            query._handleIdentityChangeEvent(evt);

            // Posttest
            expect(query.data).toBe(data);
        });

        it("Should change data array if dataType is object and item is in the data", function() {
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");
            var data = query.data = [identity.toObject()];

            // Run
            query._handleIdentityChangeEvent(evt);

            // Posttest
            expect(query.data).not.toBe(data);
        });

        it("Should trigger change event if the Identity is in the data", function() {
            var data = query.data = [identity.toObject()];
            var evt = new layer.LayerEvent({
                property: "displayName",
                oldValue: 'Frodo',
                newValue: 'FrodoTheDodo',
                target: identity
            }, "identities:change");
            spyOn(query, "_triggerChange");

            // Run
            query._handleIdentityChangeEvent(evt);

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: "property",
                target: identity.toObject(),
                query: query,
                isChange: true,
                changes: [{
                    property: "displayName",
                    oldValue: 'Frodo',
                    newValue: 'FrodoTheDodo',
                }]
            });
        });

        it("Should not trigger change event if Identity is NOT in the data", function() {
            var data = query.data = [identity.toObject()];
            var evt = new layer.LayerEvent({
                property: "displayName",
                    oldValue: 'Frodo',
                    newValue: 'FrodoTheDodo',
                target: {id: identity.id + "1"}
            }, "identities:change");
            spyOn(query, "trigger");

            // Run
            query._handleIdentityChangeEvent(evt);

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });
    });


    describe("The _handleIdentityAddEvent() method", function() {
        var query, identity2;
        beforeEach(function() {
            identity2 = client._createObject({
                id: "layer:///identities/2",
                user_id: "2",
                display_name: "2"
            });
            query = new layer.Query({
                client: client,
                model: 'Identity',
                paginationWindow: 15,
                dataType: "object",
            });
            query.data = [];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array containing new results if dataType is object", function() {
            var data = query.data = [];

            // Run
            query._handleIdentityAddEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([identity.toObject(), identity2.toObject()]);
        });

        it("Should insert new data into results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data = [];

            // Run
            query._handleIdentityAddEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([identity, identity2]);
        });

        it("Should only operate on new values", function() {
            var data = query.data = [identity.toObject()];

            // Run
            query._handleIdentityAddEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).toEqual([identity.toObject(), identity2.toObject()]);

        });


        it("Should trigger change event if new values", function() {
            var data = query.data = [];
            spyOn(query, "_triggerChange");

            // Run
            query._handleIdentityAddEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 0,
                target: identity.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'insert',
                index: 1,
                target: identity2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no new values", function() {
            spyOn(query, "trigger");
            query.data = [identity, identity2];

            // Run
            query._handleIdentityAddEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should increase the totalCount property", function() {
          expect(query.totalSize).toEqual(0);

          // Run
          query._handleIdentityAddEvent({
              identities: [identity, identity2]
          });

          // Posttest
          expect(query.totalSize).toEqual(2);
        });
    });


    describe("The _handleIdentityRemoveEvent() method", function() {
        var query, identity2;
        beforeEach(function() {
            identity2 = client._createObject({
                id: "layer:///identities/2",
                user_id: "2",
                display_name: "2"
            });
            query = new layer.Query({
                client: client,
                model: 'Identity',
                paginationWindow: 15,
                dataType: "object",
            });
            query.data = [identity.toObject(), identity2.toObject()];
        });

        afterEach(function() {
            query.destroy();
        });

        it("Should replace data with a new array without Identity if dataType is object", function() {
            var data = query.data;

            // Run
            query._handleIdentityRemoveEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).not.toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should call _updateNextFromId for server indexes", function() {
            spyOn(query, "_updateNextFromId").and.returnValue("heyho");
            query._nextServerFromId = identity2.id;

            // Run
            query._handleIdentityRemoveEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query._nextDBFromId).toEqual('');
            expect(query._nextServerFromId).toEqual('heyho');
        });

        it("Should remove data from results if dataType is instance", function() {
            query.dataType = "instance";
            var data = query.data;

            // Run
            query._handleIdentityRemoveEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query.data).toBe(data);
            expect(query.data).toEqual([]);
        });

        it("Should only operate on existing values", function() {
            var identity3 = client._createObject(responses.useridentity);
            query.data = [identity2.toObject()];

            // Run
            query._handleIdentityRemoveEvent({
                identities: [identity, identity3]
            });

            // Posttest
            expect(query.data).toEqual([identity2.toObject()]);

        });

        it("Should trigger change event for each removal", function() {
            spyOn(query, "_triggerChange");

            // Run
            query._handleIdentityRemoveEvent({
                identities: [identity, identity2]
            });

            // Posttest
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: identity.toObject(),
                query: query
            });
            expect(query._triggerChange).toHaveBeenCalledWith({
                type: 'remove',
                index: 0,
                target: identity2.toObject(),
                query: query
            });
        });

        it("Should not trigger change event if no values affected", function() {
            spyOn(query, "trigger");
            query.data = [identity2.toObject()];

            // Run
            query._handleIdentityRemoveEvent({
                identities: [identity]
            });

            // Posttest
            expect(query.trigger).not.toHaveBeenCalled();
        });

        it("Should decrease the totalCount property", function() {
          query.data = [identity, identity2];
          query.totalSize = 2;

          // Run
          query._handleIdentityRemoveEvent({
              identities: [identity]
          });

          // Posttest
          expect(query.totalSize).toEqual(1);
        });
    });

    describe('The _triggerChange() method', function() {
      var query;
      beforeEach(function() {
          query = new layer.Query({
              client: client,
              model: 'Message',
              paginationWindow: 15,
              dataType: "object",
              predicate: "conversation.id = '" + conversation.id + "'"
          });
      });

      afterEach(function() {
          query.destroy();
      });

      it("Should trigger the change event", function() {
        var spy = jasmine.createSpy('change-event');
        query.on('change', spy);
        query._triggerChange({
          type: 'insert'
        });
        expect(spy).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));
        expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
          type: 'insert'
        }));
      });

      it("Should trigger the change:type event", function() {
        var spy = jasmine.createSpy('change-event');
        query.on('change:insert', spy);
        query._triggerChange({
          type: 'insert'
        });
        expect(spy).toHaveBeenCalledWith(jasmine.any(layer.LayerEvent));
        expect(spy).toHaveBeenCalledWith(jasmine.objectContaining({
          type: 'insert'
        }));

      });
    });

    describe("The size property getter", function() {
      var query;
      beforeEach(function() {
          query = new layer.Query({
              client: client,
              model: 'Message',
              paginationWindow: 15,
              dataType: "object",
              predicate: "conversation.id = '" + conversation.id + "'"
          });

      });

      afterEach(function() {
          query.destroy();
      });
      it("Should have the correct size", function() {
        query.data = [conversation.createMessage("a"), conversation.createMessage("b"), conversation.createMessage("c")];
        expect(query.size).toEqual(3);
      });

      it("Should handle null data", function() {
        query.data = null;
        expect(query.size).toEqual(0);

        // cleanup
        query.data = [];
      });
    });
});
