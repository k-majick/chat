<template>
  <div 
    v-if="Object.keys(userData).length" 
    class="chat__container"
    :class="{ 'chat__container--expanded': isExpanded, 'chat__container--open': isOpen }"
  >
    <div class="chat__bar chat__bar--main">
      <div class="chat__avatar chat__avatar--marvin" :class="{ 'talking': isTyping }"></div>
      <div class="chat__title">
        <b>Title</b><br>
        Subtitle
      </div>
      <div class="chat__controls">
        <font-awesome-icon
          v-if="isOpen && !isExpanded"
          :icon="faCircleArrowUpLeft"
          class="chat__control"
          @click="isExpanded = !isExpanded"
        />
        <font-awesome-icon
          v-if="isOpen && isExpanded"
          :icon="faCircleArrowDownRight"
          class="chat__control"
          @click="isExpanded = !isExpanded"
        />
        <font-awesome-icon
          v-if="isOpen"
          :icon="faCircleXmark" 
          class="chat__control chat__control--close" 
          @click="isOpen = !isOpen; isExpanded = false;"
        />
        <font-awesome-icon
          v-if="!isOpen"
          :icon="faCircleQuestion" 
          class="chat__control chat__control--open" 
          @click="isOpen = !isOpen"
        />
      </div>
    </div>
    <div class="chat">
      <div class="chat__box">
        <button 
          v-if="isLoading || isTyping"
          class="chat__control chat__control--stop"
          @click="stopResponding"
        >
          <font-awesome-icon
            :icon="faCircleStop"
          />&nbsp;Stop responding
        </button>
        <div 
          class="chat__items" 
          v-for="(item, index) in items"
          :key="index + itemKey"
          :ref="el => { itemsRef[index] = el }"
        >
          <div class="chat__item chat__item--query">
            {{ item.query }}
            <div class="chat__avatar chat__avatar--user">
              <span v-if="userData.displayName">
                {{ userData.displayName.substring(0, 1) }}
              </span>
              <span v-else>
                <font-awesome-icon :icon="faUser" />
              </span>
            </div>
          </div>
          <div 
            v-show="item.answer?.length"
            class="chat__item chat__item--answer"
            :class="{ 'error': item.error }"
          >
            <div v-if="index === 0 && isLoading && !isTyping" class="chat__dots"></div>
            <span v-html="item.answer"></span>
            <div class="chat__avatar chat__avatar--marvin"></div>
          </div>
          <div 
            v-show="item.hasError"
            class="chat__item chat__item--error"
          >
            Error
            <div class="chat__avatar chat__avatar--marvin"></div>
          </div>
        </div>
      </div>
    </div>
    <!-- how can i create subject in marvin -->
    <div class="chat__bar chat__bar--input">
      <textarea
        v-model="query"
        class="chat__input"
        :placeholder="'Placeholder'"
        @keydown="sendQuery($event, { query })"
      />
      <button class="chat__control" :disabled="!query.replace(/\n/g, '').length">
        <font-awesome-icon
          class="chat__control--send"
          :icon="faPaperPlaneTop"
          @click="sendQuery($event, { query })"
        />
      </button>
    </div>
  </div>
</template>
  
<script lang="ts" setup>
import { ref, nextTick } from 'vue';
import { type Ref } from 'vue';
import { 
  faCircleXmark, 
  faCircleArrowUpLeft,
  faCircleArrowDownRight,
  faCircleQuestion,
  faPaperPlaneTop,
  faUser,
  faCircleStop,
} from '@fortawesome/pro-duotone-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'

interface IQuery {
  query?: string,
  answer?: string,
  hasError?: boolean,
  error?: string,
}

const userData = {
  displayName: "Admin",
}
const isOpen = ref(true);
const isExpanded = ref(false);
const isLoading = ref(false);
const isTyping = ref(false);
const isStopped = ref(false);
const itemsRef: Ref<string[]> = ref([]);
const query = ref('');
const itemKey = ref(0);
const items: Ref<IQuery[]> = ref([]);
const BASE_API_URL_DEV = '/api/chat-messages';
const BASE_API_URL_PROD = 'https://api.dify.ai/api/chat-messages';

const controller = ref(new AbortController());
const signal = ref(controller.value.signal);

const displayAnswer = (data: string): Promise<void> => {
  let promise = Promise.resolve();
  const jsonObjects: string[] = data.split('\ndata: ');

  jsonObjects.shift();
  isLoading.value = false;
  isTyping.value = true;

  const parsedObjects = jsonObjects.map((jsonStr) => {
    const lines = jsonStr.split('\n');
    const cleanedLines = lines.filter(line => !line.includes('event: ping'));
    const cleanedData = cleanedLines.join('\n');

    return JSON.parse(cleanedData);
  });
 
  parsedObjects.forEach((o) => {
    promise = promise.then(() => {
      if (!o.answer) {
        return;
      }

      if (isStopped.value) {
        delete items.value[0].answer;
        isStopped.value = false;
        isTyping.value = false;
        return promise;
      }

      items.value[0].answer += o.answer.replace(/\n/g, '<br>');
    });

    promise = promise.then(() => new Promise((resolve) => setTimeout(resolve, 100)));
  });

  return promise;
}

const displayError = () => {
  items.value[0].answer = "";
  items.value[0].hasError = true;
  isLoading.value = false;
  isTyping.value = false;
}

console.dir(import.meta.env)

const sendQuery = (e: Event, currentQuery: IQuery) => {
  if (isLoading.value || isTyping.value) {
    e.preventDefault();
    return;
  }

  if (e instanceof KeyboardEvent && e.key === "Enter") {
    if (e.shiftKey) {
      return;
    } else {
      e.preventDefault();
    }

    if (!currentQuery.query?.replace(/ /g, '').length) {
      e.preventDefault();
      return;
    }
    
  } else if (e instanceof MouseEvent && e.type === "click") {   
    if (!currentQuery.query?.replace(/ /g, '').length) {
      return;
    }
  } else {
    return;
  }

  const apiUrl = import.meta.env.MODE === 'development' ? 
    BASE_API_URL_DEV : BASE_API_URL_PROD;

  isLoading.value = true;
  query.value = "";
  items.value.unshift({});
  itemsRef.value.unshift(`queryEl-${items.value.length}`);

  items.value[0].answer = " ";
  items.value[0].query = currentQuery.query;

  const requestBody = {
    inputs: {},
    query: currentQuery,
    response_mode: 'streaming',
    conversation_id: '',
    user: "Admin",
  };

  const headers = new Headers({
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json',
  });

  headers.append('Authorization', `Bearer ${import.meta.env.VITE_DIFY_SECRET}`);

  const requestOptions = {
    method: 'POST',
    headers: headers,
    signal: signal.value,
    body: JSON.stringify(requestBody),
  };

  fetch(apiUrl, requestOptions)
    .then((response) => {
      if (!response.ok) {
        displayError();
        throw new Error('Network response was not ok');
      }

      return response.text();
    })

    .then((data) => {
      nextTick(() => {
        displayAnswer(data).then(() => {          
          isTyping.value = false;
        });
      });
    })

    .catch((error) => {
      if (isStopped.value) {
        isStopped.value = false;
        controller.value = new AbortController();
        signal.value = controller.value.signal;
        return;
      }
      displayError();
      console.error('Error:', error);
    });
}

const abortFetching = () => {
  controller.value.abort();
  items.value[0].answer = "";
  isLoading.value = false;
}

const stopResponding = () => {
  isStopped.value = true;

  if (isLoading.value) {
    abortFetching();
  }
}
</script>

<style lang="scss">
@import "@/assets/_chat.scss";
</style>
