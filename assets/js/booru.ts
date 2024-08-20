import { $ } from './utils/dom';
import store from './utils/store';
import { timeAgo } from './timeago';
import { TagData } from './utils/tag';
import { matchNone } from './query/boolean';
import { parseSearch } from './match_query';
import { assertNotNull } from './utils/assert';

/**
 * Store a tag locally, marking the retrieval time
 */
function persistTag(tagData: TagData) {
  const persistData = {
    ...tagData,
    fetchedAt: new Date().getTime() / 1000,
  };

  store.set(`bor_tags_${tagData.id}`, persistData);
}

function isStale(tag: TagData) {
  const now = new Date().getTime() / 1000;
  return tag.fetchedAt === null || tag.fetchedAt < now - 604800;
}

function clearTags() {
  Object.keys(localStorage).forEach(key => {
    if (key.substring(0, 9) === 'bor_tags_') {
      store.remove(key);
    }
  });
}

/**
 * Fetches lots of tags in batches and stores them locally
 */
function fetchAndPersistTags(tagIds: number[]) {
  if (!tagIds.length) return;

  const ids = tagIds.slice(0, 40);
  const remaining = tagIds.slice(41);

  fetch(`/fetch/tags?ids[]=${ids.join('&ids[]=')}`)
    .then(response => response.json())
    .then(data => (data.tags as TagData[]).forEach(tag => persistTag(tag)))
    .then(() => fetchAndPersistTags(remaining));
}

/**
 * Figure out which tags in the list we don't know about
 */
function fetchNewOrStaleTags(tagIds: number[]) {
  const fetchIds: number[] = [];

  tagIds.forEach(t => {
    const stored = store.get<TagData>(`bor_tags_${t}`);
    if (!stored || isStale(stored)) {
      fetchIds.push(t);
    }
  });

  fetchAndPersistTags(fetchIds);
}

function verifyTagsVersion(latest: number) {
  if (store.get('bor_tags_version') !== latest) {
    clearTags();
    store.set('bor_tags_version', latest);
  }
}

/**
 * Returns a single tag, or a dummy tag object if we don't know about it yet
 */
export function getTag(tagId: number) : TagData {
  const stored = store.get<TagData>(`bor_tags_${tagId}`);

  if (stored !== null) {
    return stored;
  }

  return {
    id: tagId,
    name: '(unknown tag)',
    images: 0,
    spoiler_image_uri: null,
    fetchedAt: null,
  };
}

function initializeFilters() {
  const tags = window.booru.spoileredTagList.concat(window.booru.hiddenTagList)
                .filter((a, b, c) => c.indexOf(a) === b);

  verifyTagsVersion(window.booru.tagsVersion);
  fetchNewOrStaleTags(tags);
}

function unmarshal(data: unknown) {
  try {
    return JSON.parse(data);
  } catch {
    return data;
  }
}

export function loadBooruData() {
  const booruData = assertNotNull($<HTMLElement>('.js-datastore')).dataset;

  if (booruData) {
    // Assign all elements to booru because lazy
    for (const prop in booruData) {
      window.booru[prop] = unmarshal(booruData[prop]);
    }

    window.booru.hiddenFilter = parseSearch(booruData.hiddenFilter || "");
    window.booru.spoileredFilter = parseSearch(booruData.spoileredFilter || "");
  }

  // Fetch tag metadata and set up filtering
  initializeFilters();

  // CSRF
  window.booru.csrfToken = assertNotNull($<HTMLMetaElement>('meta[name="csrf-token"]')).content;
}

// These are just default values to make sure nothing's null or undefined that shouldn't be.
window.booru = {
  timeAgo: timeAgo,
  csrfToken: '',
  spoilerType: 'click',
  imagesWithDownvotingDisabled: [],
  watchedTagList: [],
  spoileredTagList: [],
  ignoredTagList: [],
  hiddenTagList: [],
  hiddenTag: '/images/tagblocked.svg',
  userIsSignedIn: false,
  userCanEditFilter: false,
  hiddenFilter: matchNone(),
  spoileredFilter: matchNone(),
  tagsVersion: 0,
  interactions: [],
  hideStaffTools: 'false',
  galleryImages: undefined
};
