/**
 * spa.util.js
 * General Javascript utilities
*/

/*jslint    browser : true, continue: true,
  devel : true, indent : 2, maxerr : 50,
  newcap : true, nomen : true, plusplus : true,
  regexp : true, sloppy : true, vars : false,
  white : true
*/
/*global $, spa */

spa.util = (function (){
	var makeError, setConfigMap;
	
	//Begin public constrctor /makeError/
	//Purpose: a convenience wrapper to create an error object
	makeError = function (name_text, msg_text, data){
		var error = new Error();
		error.name = name_text;
		error.message = msg_text;
		if(data){error.data = data;}
		
		return error;
	};
	//End public constructor /makeError/
	
	//Begin public method /setConfigMap/
	//Purpose: Common code to set configs in feature modules
	setConfigMap = function (arg_map){
		var
			input_map = arg_map.input_map,
			settable_map = arg_map.settable_map,
			config_map = arg_map.config_map,
			key_name, error;
			
		for(key_name in input_map){
			if(input_map.hasOwnProperty(key_name)){
				if(settable_map.hasOwnProperty(key_name)){
					config_map[key_name] = input_map[key_name];
				}
				else{
					error = makeError('Bad Input',
						'Setting config key |' + key_name + '| is not supported'
					);
					throw error;
				}
			}
		}
	};
	//End public method /setConfigMap/
	
	return {
		makeError : makeError,
		setConfigMap : setConfigMap
	};
}());
spa.shell = (function () {
	//-------------------BEGIN MODULE SCOPE VARIABLES ---------------
	var configMap = {
		anchor_schema_map : {
			chat : {open:true, closed:true}
		},
		main_html : String()
			+'<div id="spa">\
			<div class="spa-shell-head">\
				<div class="spa-shell-head-logo"></div>\
				<div class="spa-shell-head-acct"></div>\
				<div class="spa-shell-head-search"></div>\
			</div>\
			<div class="spa-shell-main">\
				<div class="spa-shell-main-nav"></div>\
				<div class="spa-shell-main-content"></div>\
			</div>\
			<div class="spa-shell-foot"></div>\
			<div class="spa-shell-chat"></div>\
			<div class="spa-shell-modal"></div>\
		</div>',
		chat_extend_time : 1000,
		chat_retract_time : 300,
		chat_extend_height : 450,
		chat_retract_height : 15,
		chat_extended_title : 'Click to retract',
		chat_retracted_title : 'Click to extend'
		},
		stateMap = {$container : null,
			anchor_map : {},
			is_chat_retracted : true
			},
		jqueryMap = {},
		copyAnchorMap, setJqueryMap, toggleChat, changeAnchorPart, 
		onHashchange, onClickChat,initModule;
	//------------------END MODULE SCOPE VARIABLES ------------------
	
	//------------------BEGIN UTILITY VARIABLES ----------------
	//Returns copy of stored anchor map; minimizes overhead
	copyAnchorMap = function (){
		return $.extend(true, {}, stateMap.anchor_map);
	};
	//------------------END UTILITY VARIABLES ------------------
	
	//------------------BEGIN DOM METHODS ----------------------
	setJqueryMap = function (){
		var $container = stateMap.$container;
		jqueryMap = {$container : $container,
			$chat: $container.find( '.spa-shell-chat')
			};
	}
	// End DOM method /setJqueryMap/
	// BEGIN DOM method /toggleChat/
	//Purpose : Extends or retracts chat slider
	//Arguments :
	//    * do_extend - if true, extends slider; if false retracts
	//    * callback - optional function to execute at end of animation
	//Settings :
	//    * chat_extend_time, chat_retract_time
	//    * chat_extend_height, chat_retract_height
	//Returns : boolean
	//    * true - slider animation activated
	//    * false - slider animation not activated
	//State : sets stateMap.is_chat_retracted
	//    * true - slider is retracted
	//    * false - slider is extended
	toggleChat = function ( do_extend, callback ){
		var
			px_chat_ht = jqueryMap.$chat.height();
			is_open = px_chat_ht === configMap.chat_extend_height,
			is_closed = px_chat_ht === configMap.chat_retract_height,
			is_sliding = !is_open && ! is_closed;
		
		//avoid race condition
		if( is_sliding) {return false;}
		
		//Begin extend chat slider
		if (do_extend){
			jqueryMap.$chat.animate(
				{height : configMap.chat_extend_height },
				configMap.chat_extend_time,
				function (){
					jqueryMap.$chat.attr(
						'title',configMap.chat_extended_title
						);
					stateMap.is_chat_retracted = false;
					if(callback) {callback (jqueryMap.$chat);}
				}
			);
			return true;
		}
		//End extend chat slider
		
		//Begin retract chat slider
		jqueryMap.$chat.animate(
			{height : configMap.chat_retract_height},
			configMap.chat_retract_time,
			function (){
				jqueryMap.$chat.attr(
					'title', configMap.chat_retracted_title
					);
				stateMap.is_chat_retracted = true;
				if(callback) {callback(jqueryMap.$chat);}
			}
		);
		return true;
		//End retract chat slider
	};
	//End DOM method /toggleChat/
	//Begin DOM method /changeAnchorPart/
	//Purpose : Changes part of the URI anchor component
	changeAnchorPart = function (arg_map){
		var anchor_map_revise = copyAnchorMap(),
		bool_return = true,
		key_name, key_name_dep;
		
		//Begin merge changes into anchor map
		KEYVAL:
		for(key_name in arg_map){
			if(arg_map.hasOwnProperty(key_name)){
				//skip dependent keys during iteration
				if(key_name.indexOf('_') === 0) {continue KEYVAL;}
				
				//update independent key value
				anchor_map_revise[key_name] = arg_map[key_name];
				
				//update matching dependent key
				key_name_dep = '_' + key_name;
				if(arg_map[key_name_dep]){
					anchor_map_revise[key_name_dep] = arg_map[key_name_dep];
				}
				else {
					delete anchor_map_revise[key_name_dep];
					delete anchor_map_revise['_s' + key_name_dep];
				}
			}
		}
		//End merge changes into anchor map
		
		//Begin attempt to update URI; revert if not successful
		try{
			$.uriAnchor.setAnchor(anchor_map_revise);
		}
		catch (error){
			//replace URI with existing state
			$.uriAnchor.setAnchor(stateMap.anchor_map, null, true);
			bool_return = false;
		}
		//End attempt to update URI...
		
		return bool_return;
	};
	//End DOM method /changeAnchorPart/
	//------------------END DOM METHODS ------------------------
	
	//------------------BEGIN EVENT HANDLERS -------------------
	//Begin Event handler /onHashchange/
	//Purpose: Handles the hashchange event
	//Arguments:
	//    * event - jQuery event object.
	//Settings : none
	//Returns : false;
	onHashchange = function (event){
		var
			anchor_map_previous = copyAnchorMap(),
			anchor_map_proposed,
			_s_chat_previous, _s_chat_proposed,
			s_chat_proposed;
			
			//attempt to parse anchor
			try {
				anchor_map_proposed = $.uriAnchor.makeAnchorMap();}
			catch(error){
				$uriAnchor.setAnchor(anchor_map_previous, null, true);
				return false;
			}
			stateMap.anchor_map = anchor_map_proposed;
			
			//convenience vars
			_s_chat_previous = anchor_map_previous._s_chat;
			_s_chat_proposed = anchor_map_proposed._s_chat;
			
			//Begin adjust chat component if changed
			if(!anchor_map_previous || _s_chat_previous !== _s_chat_proposed){
				s_chat_proposed = anchor_map_proposed.chat;
				switch(s_chat_proposed){
					case 'open':
						toggleChat(true);
						break;
					case 'closed':
						toggleChat(false);
						break;
					default:
						toggleChat(false);
						delete anchor_map_proposed.chat;
						$.uriAnchor.setAnchor(anchor_map_proposed,null,true);
				}
			}
			//End adjust chat component if changed
			
			return false;
	};
	//End event handler /onHashchange/
	
	//Begin Event handler /onClickChat/
	onClickChat = function (event) {
		changeAnchorPart({
			chat: (stateMap.is_chat_retracted ? 'open' : 'closed')
		});
		return false;
	};
	//End event handler /onClickChat/
	//-------------------END EVENT HANDLERS --------------------
	
	//------------------BEGIN PUBLIC METHODS -------------------
	//Begin Public method /initModule/
	initModule = function ($container) {
		//load HTML and map jQuery collections
		stateMap.$container = $container;
		$container.html(configMap.main_html);
		setJqueryMap();

		//initialize chat slider and bind click handler
		stateMap.is_chat_retracted = true;
		jqueryMap.$chat
			.attr('title', configMap.chat_retracted_title)
			.click (onClickChat);
		
		//configure uriAnchor to use our schema
		$.uriAnchor.configModule({
			schema_map : configMap.anchor_shcema_map
		});		
		
		//Handle URI anchor change events.
		$(window)
			.bind('hashchange', onHashchange)
			.trigger('hashchange');
	};
	//End Public method /initModule/
	
	return { initModule : initModule };
	//-------------------END PUBLIC METHODS---------------------
} ());