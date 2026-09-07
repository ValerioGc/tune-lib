<script setup lang="ts">
import { computed, defineAsyncComponent, onMounted, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import AppButton from '@/components/common/controls/AppButton.vue';
import AppIcon from '@/components/common/AppIcon.vue';
import AppModal from '@/components/common/controls/AppModal.vue';
import AppSpinner from '@/components/common/placeholder/AppSpinner.vue';
import DefaultPlayerBanner from '@/components/library/messages/DefaultPlayerBanner.vue';
import LibraryBanner from '@/components/library/messages/LibraryBanner.vue';
import LibraryContentTabs from '@/components/library/header/LibraryContentTabs.vue';
import LibraryCounts from '@/components/library/header/LibraryCounts.vue';
import LibraryEmptyState from '@/components/library/messages/LibraryEmptyState.vue';
import LibraryImportProgress from '@/components/library/messages/LibraryImportProgress.vue';
import LibraryAlbumSummary from '@/components/library/groups/LibraryAlbumSummary.vue';
import LibraryFacetList, {
  type FacetGroupOpenPayload,
} from '@/components/library/groups/LibraryFacetList.vue';
import LibraryGroupCarousel, {
  type CarouselGroup,
} from '@/components/library/groups/LibraryGroupCarousel.vue';
import LibraryViewToggle from '@/components/library/header/LibraryViewToggle.vue';
import LibrarySortSelect from '@/components/library/header/LibrarySortSelect.vue';
import LibraryTable from '@/components/library/table/LibraryTable.vue';
import LibraryTabs from '@/components/library/header/LibraryTabs.vue';
import LibraryTitle from '@/components/library/header/LibraryTitle.vue';
import LibraryToolbar from '@/components/library/header/LibraryToolbar.vue';
import PreviewSizeToggle from '@/components/library/preview/PreviewSizeToggle.vue';
import type { PreviewCardMeta } from '@/components/library/preview/PreviewCard.vue';
import PreviewGrid from '@/components/library/preview/PreviewGrid.vue';
import { useFileDrop } from '@/composables/useFileDrop';
import {
  DEFAULT_FACET_SORT,
  facetSortColumns,
  type FacetField,
  type FacetSort,
} from '@/services/facet-columns';
import { useLibraryStore } from '@/stores/library';
import { usePlayerStore } from '@/stores/player';
import { useSettingsStore } from '@/stores/settings';
import type { LibraryContentTab, TrackSelectionIntent, TrackView } from '@/types/library';
import type { PreviewSizePage, TableColumnKey, ViewMode } from '@/types/settings';

const LibraryImportReport = defineAsyncComponent(
  () => import('@/components/library/messages/LibraryImportReport.vue'),
);
const BulkMetadataEditor = defineAsyncComponent(
  () => import('@/components/metadata/BulkMetadataEditor.vue'),
);
const MetadataEditor = defineAsyncComponent(
  () => import('@/components/metadata/MetadataEditor.vue'),
);

const { t } = useI18n();
const library = useLibraryStore();
const settings = useSettingsStore();
const player = usePlayerStore();
const pendingRemoval = ref<TrackView | null>(null);
const isRemovingMissing = ref(false);
const selectedFacet = ref<FacetGroupOpenPayload | null>(null);
const facetModalHistory = ref<FacetModalState[]>([]);
const activeTab = ref<LibraryContentTab>('tracks');

const groupModalViewMode = ref<ViewMode>('preview');
const facetViewModes = ref<Record<FacetField, ViewMode>>({
  artist: 'preview',
  album: 'preview',
  genre: 'preview',
});
/** What the genre modal lists under its carousels. */
const genreModalList = ref<GenreModalList>('tracks');
const selectionAnchorId = ref<string | null>(null);
const isBulkEditorOpen = ref(false);
// The modal tables are read, not configured: each lists a fixed set of columns, without the
// field the modal is already about.
const artistModalColumnKeys = [
  'cover',
  'title',
  'album',
  'year',
  'duration',
] as const satisfies readonly TableColumnKey[];
// The album modal names its year and its artists in the header: the list underneath repeats
// neither, in table or in preview.
const albumModalColumnKeys = [
  'cover',
  'title',
  'duration',
] as const satisfies readonly TableColumnKey[];
const albumModalPreviewMetaKeys = [] as const satisfies readonly PreviewCardMeta[];
const genreModalColumnKeys = [
  'cover',
  'title',
  'artist',
  'album',
  'year',
  'duration',
] as const satisfies readonly TableColumnKey[];

type GenreModalList = 'tracks' | 'artists' | 'albums';

interface FacetModalState {
  group: FacetGroupOpenPayload;
  viewMode: ViewMode;
  genreList: GenreModalList;
}

const activeFacet = computed<FacetField | null>(() => {
  if (activeTab.value === 'artists') {
    return 'artist';
  }

  if (activeTab.value === 'albums') {
    return 'album';
  }

  if (activeTab.value === 'genres') {
    return 'genre';
  }

  return null;
});

const selectedFacetTracks = computed(() => {
  const facet = selectedFacet.value;

  if (facet === null) {
    return [];
  }

  return library.visibleTracks.filter((track) => facetKeyOf(track, facet.field) === facet.key);
});

const selectedAlbumGenreLinks = computed<FacetGroupOpenPayload[]>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return [];
  }

  return [...new Set(selectedFacetTracks.value.map((track) => facetKeyOf(track, 'genre')))]
    .sort((left, right) => facetNameOf('genre', left).localeCompare(facetNameOf('genre', right)))
    .map((key) => ({
      field: 'genre',
      key,
      name: facetNameOf('genre', key),
    }));
});

const selectedAlbumCoverTrack = computed<TrackView | null>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return null;
  }

  return (
    selectedFacetTracks.value.find((track) => track.hasCover && !track.missing) ??
    selectedFacetTracks.value[0] ??
    null
  );
});

const selectedAlbumYear = computed<number | null>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return null;
  }

  return selectedFacetTracks.value.find((track) => track.year !== null)?.year ?? null;
});

const selectedAlbumArtistLinks = computed<FacetGroupOpenPayload[]>(() => {
  if (selectedFacet.value?.field !== 'album') {
    return [];
  }

  return [...new Set(selectedFacetTracks.value.map((track) => facetKeyOf(track, 'artist')))]
    .sort((left, right) => facetNameOf('artist', left).localeCompare(facetNameOf('artist', right)))
    .map((key) => ({
      field: 'artist',
      key,
      name: facetNameOf('artist', key),
    }));
});

interface ModalAlbumGroup {
  key: string;
  name: string;
  year: number | null;
  tracks: TrackView[];
  coverTrack: TrackView | null;
  playing: boolean;
  isUnknown: boolean;
}

const selectedFacetAlbums = computed<ModalAlbumGroup[]>(() => {
  const grouped = new Map<string, TrackView[]>();

  for (const track of selectedFacetTracks.value) {
    const value = track.album?.trim() ?? '';
    const key = value.length > 0 ? value : '__unknown__';
    grouped.set(key, [...(grouped.get(key) ?? []), track]);
  }

  return [...grouped.entries()]
    .map(([key, tracks]) => {
      const isUnknown = key === '__unknown__';

      return {
        key,
        name: isUnknown ? t('library.groups.unknown.album') : key,
        year: tracks.find((track) => track.year !== null)?.year ?? null,
        tracks,
        coverTrack: tracks.find((track) => track.hasCover && !track.missing) ?? tracks[0] ?? null,
        playing:
          player.currentTrack !== null &&
          tracks.some((track) => track.id === player.currentTrack?.id),
        isUnknown,
      };
    })
    .sort((left, right) => {
      if (left.isUnknown !== right.isUnknown) {
        return left.isUnknown ? 1 : -1;
      }

      if (left.year !== right.year && left.year !== null && right.year !== null) {
        return left.year - right.year;
      }

      return left.name.localeCompare(right.name);
    });
});

const albumCarouselGroups = computed<CarouselGroup[]>(() =>
  selectedFacetAlbums.value.map((album) => ({
    key: album.key,
    name: album.name,
    meta: album.year === null ? null : String(album.year),
    coverTrack: album.coverTrack,
    playing: album.playing,
  })),
);

const genreModalTabs = computed(() =>
  (['tracks', 'artists', 'albums'] as const satisfies readonly GenreModalList[]).map((tab) => ({
    id: tab,
    label: t(`library.tabs.${tab}`),
  })),
);

const activeFacetViewMode = computed(() =>
  activeFacet.value === null ? 'preview' : facetViewModes.value[activeFacet.value],
);

const displayedViewMode = computed(() =>
  activeTab.value === 'tracks' ? settings.viewMode : activeFacetViewMode.value,
);

/**
 * How the list of groups on the open tab is ordered.
 *
 * Held here because the control that changes it is in the toolbar, at the top of the page,
 * while the list it orders is in the panel below: neither can reach the other.
 */
const facetSort = ref<FacetSort>({ ...DEFAULT_FACET_SORT });

// Each tab has columns of its own: an order left over from the previous one would have
// nothing to read.
watch(activeFacet, () => {
  facetSort.value = { ...DEFAULT_FACET_SORT };
});

const facetSortOptions = computed(() =>
  activeFacet.value === null
    ? []
    : facetSortColumns(activeFacet.value).map((column) => ({
        value: column.key,
        label: t(column.sortLabelKey ?? column.labelKey),
      })),
);

function sortFacets(column: string) {
  const wanted = column as FacetSort['column'];

  facetSort.value =
    facetSort.value.column === wanted
      ? { column: wanted, direction: facetSort.value.direction === 'asc' ? 'desc' : 'asc' }
      : { column: wanted, direction: 'asc' };
}

/**
 * Whether the toolbar shows a way to order what is below it.
 *
 * Only the preview needs one — a table is ordered from its own headings — and a list of
 * genres is a handful of names read in one go, which is left alone.
 */
const showsSortControl = computed(
  () => displayedViewMode.value === 'preview' && activeTab.value !== 'genres',
);

/**
 * What the window of a genre is listing, and how.
 *
 * A window is not the page: it shows the artists or the albums of one genre, and the order
 * chosen in it is its own. The size of the cards is not — that belongs to the artists and to
 * the albums wherever they are shown, so the control here moves the same setting the page
 * uses.
 */
const genreModalField = computed<FacetField>(() =>
  genreModalList.value === 'artists' ? 'artist' : 'album',
);

const genreModalSort = ref<FacetSort>({ ...DEFAULT_FACET_SORT });

watch(genreModalList, () => {
  genreModalSort.value = { ...DEFAULT_FACET_SORT };
});

const genreModalSortOptions = computed(() =>
  facetSortColumns(genreModalField.value).map((column) => ({
    value: column.key,
    label: t(column.sortLabelKey ?? column.labelKey),
  })),
);

function sortGenreModal(column: string) {
  const wanted = column as FacetSort['column'];

  genreModalSort.value =
    genreModalSort.value.column === wanted
      ? {
          column: wanted,
          direction: genreModalSort.value.direction === 'asc' ? 'desc' : 'asc',
        }
      : { column: wanted, direction: 'asc' };
}

/** The page whose card size the toolbar is asking about, when cards are on screen. */
const previewSizePage = computed<PreviewSizePage | undefined>(() =>
  displayedViewMode.value === 'preview' ? activeTab.value : undefined,
);

const { isDraggingOver } = useFileDrop((paths) => {
  library.addPaths(paths);
});

onMounted(async () => {
  // Returning from help or settings remounts this view. If a library is already active,
  // refresh that library instead of treating the return as a fresh home-page visit.
  if (library.activeLibraryId !== null) {
    await library.load();
    return;
  }

  await library.loadHomeLibrary(settings.mainLibraryId);
});

watch(activeTab, (tab) => {
  // A search belongs to the current library section.
  if (library.query !== '') {
    library.setQuery('');
  }

  // Missing-data filters only make sense on the tracks page. Leaving it active on a grouped
  // page made the next visit look empty and effectively locked the navigation there.
  if (tab !== 'tracks' && library.missingInfoFilter !== 'all') {
    library.setMissingInfoFilter('all');
  }
});

watch(
  () => settings.mainLibraryId,
  async (mainLibraryId) => {
    if (settings.isReady && mainLibraryId !== null) {
      await library.loadHomeLibrary(mainLibraryId);
    }
  },
);

/** The visible list becomes the queue, so previous and next follow what is on screen. */
/** The file is read again first: what plays is what is on the disk right now. */
/**
 * Whether the files gone from disk are worth raising, or have already been answered for.
 *
 * The warning is closed for good rather than for the session: the count beside the tabs is
 * what keeps the situation on screen, so repeating the banner at every start says nothing
 * new. It comes back when the check finds a set of files the closed one did not cover — a
 * track that has just gone — and then carries the count as it now stands.
 */
const showsMissingBanner = computed(
  () =>
    library.hasMissingAfterRefresh && library.missingReportKey !== settings.dismissedMissingReport,
);

const hasMissingFromLibraryImport = computed(
  () => (library.lastLibraryImport?.missing.length ?? 0) > 0,
);

const showsRecoveredBanner = computed(() => library.lastRefreshRecovered > 0);

const showsVerificationBanner = computed(() => {
  const verification = library.lastVerification;

  if (verification === null) {
    return false;
  }

  return (
    verification.missing === 0 ||
    library.missingReportKey === '' ||
    library.missingReportKey !== settings.dismissedMissingReport
  );
});

async function dismissMissingReport() {
  const key = library.missingReportKey;

  if (key !== '') {
    await settings.setDismissedMissingReport(key);
  }
}

async function rememberMissingBannerDismissal() {
  const key = library.missingReportKey;

  if (key !== '') {
    await settings.setDismissedMissingReport(key);
  }
}

// A check that finds nothing gone closes the matter, so what was answered for is forgotten:
// the same files going missing a second time are news again rather than an old answer.
watch(
  () => library.lastRefresh,
  (report) => {
    if (report === null || report.missing.length > 0 || settings.dismissedMissingReport === '') {
      return;
    }

    settings.setDismissedMissingReport('').catch((error: unknown) => {
      console.error('Clearing the answered missing report failed', error);
    });
  },
);

// A file found again by a single-track check changes the current set even when no full
// refresh report was produced. Forget the old answer so a later disappearance is news again.
watch(
  () => library.missingReportKey,
  (key) => {
    if (key === '' && settings.dismissedMissingReport !== '') {
      settings.setDismissedMissingReport('').catch((error: unknown) => {
        console.error('Clearing the answered missing report failed', error);
      });
    }
  },
);

/** The track whose file was not there when it was asked for, named on a banner. */
const unplayableTitle = ref<string | null>(null);

// A direct attempt to open a missing track is a fresh user action: it must still explain why
// nothing happened even when the persistent library warning was already dismissed.
async function dismissUnplayableBanner() {
  unplayableTitle.value = null;
  await rememberMissingBannerDismissal();
}

function openMissingRemovalFromPlayback() {
  isRemovingMissing.value = true;
  unplayableTitle.value = null;
}

async function dismissVerificationBanner() {
  const hasMissing = library.lastVerification?.missing ?? 0;

  library.dismissVerification();

  if (hasMissing > 0) {
    await rememberMissingBannerDismissal();
  }
}

/**
 * Whether the track can still be played, checked against the disk rather than against what
 * the list happens to be showing.
 *
 * A file can leave between one refresh and the next, so the answer is taken from the copy
 * that comes back from the check. Opening the player on a file that is gone means a bar
 * carrying an error and nothing to play, which is worse than not opening it at all.
 */
async function isPlayable(track: TrackView): Promise<boolean> {
  const refreshed = (await library.refreshTrack(track.id)) ?? track;

  if (refreshed.missing) {
    unplayableTitle.value = refreshed.title;

    return false;
  }

  unplayableTitle.value = null;

  return true;
}

async function startPlayback(track: TrackView) {
  if (await isPlayable(track)) {
    await player.playFrom(library.visibleTracks, track.id);
  }
}

async function startFacetPlayback(track: TrackView) {
  if (await isPlayable(track)) {
    await player.playFrom(selectedFacetTracks.value, track.id);
  }
}

function facetKeyOf(track: TrackView, field: FacetField) {
  const value = track[field]?.trim() ?? '';
  return value.length > 0 ? value : '__unknown__';
}

function facetNameOf(field: FacetField, key: string) {
  return key === '__unknown__' ? t(`library.groups.unknown.${field}`) : key;
}

function askRemoval(track: TrackView) {
  closeFacetModal();
  pendingRemoval.value = track;
}

function openEditor(track: TrackView) {
  closeFacetModal();
  library.openEditor(track.id);
}

function currentFacetModalState(): FacetModalState | null {
  if (selectedFacet.value === null) {
    return null;
  }

  return {
    group: { ...selectedFacet.value },
    viewMode: groupModalViewMode.value,
    genreList: genreModalList.value,
  };
}

function applyFacetModalDefaults(group: FacetGroupOpenPayload) {
  groupModalViewMode.value = group.field === 'album' ? 'table' : facetViewModes.value[group.field];
  genreModalList.value = 'tracks';
}

function openFacet(group: FacetGroupOpenPayload) {
  const currentState = currentFacetModalState();

  if (currentState === null) {
    facetModalHistory.value = [];
  } else {
    facetModalHistory.value = [...facetModalHistory.value, currentState];
  }

  applyFacetModalDefaults(group);
  selectedFacet.value = group;
}

function openAlbumFromCarousel(key: string) {
  openFacet({ field: 'album', key, name: facetNameOf('album', key) });
}

function openArtistFromCarousel(key: string) {
  openFacet({ field: 'artist', key, name: facetNameOf('artist', key) });
}

function openGenreFromSummary(key: string) {
  openFacet({ field: 'genre', key, name: facetNameOf('genre', key) });
}

const previousFacet = computed(() => facetModalHistory.value.at(-1)?.group ?? null);

function goBackInFacetModal() {
  const previous = facetModalHistory.value.at(-1);

  if (previous === undefined) {
    return;
  }

  facetModalHistory.value = facetModalHistory.value.slice(0, -1);
  selectedFacet.value = previous.group;
  groupModalViewMode.value = previous.viewMode;
  genreModalList.value = previous.genreList;
}

function closeFacetModal() {
  selectedFacet.value = null;
  facetModalHistory.value = [];
}

function selectFromTracks(intent: TrackSelectionIntent, tracks: readonly TrackView[]) {
  if (intent.range && selectionAnchorId.value !== null) {
    const anchorIndex = tracks.findIndex((track) => track.id === selectionAnchorId.value);
    const targetIndex = tracks.findIndex((track) => track.id === intent.id);

    if (anchorIndex >= 0 && targetIndex >= 0) {
      const start = Math.min(anchorIndex, targetIndex);
      const end = Math.max(anchorIndex, targetIndex);
      library.setSelected(tracks.slice(start, end + 1).map((track) => track.id));
      return;
    }
  }

  if (intent.additive) {
    library.toggleSelected(intent.id);
  } else {
    library.select(intent.id);
  }

  selectionAnchorId.value = intent.id;
}

function openBulkEditor() {
  if (library.selectedTracks.length > 1) {
    isBulkEditorOpen.value = true;
  }
}

function setDisplayedViewMode(mode: ViewMode) {
  if (activeTab.value === 'tracks') {
    settings.setViewMode(mode);
    return;
  }

  if (activeFacet.value !== null) {
    facetViewModes.value = { ...facetViewModes.value, [activeFacet.value]: mode };
  }
}

async function confirmRemoval() {
  const track = pendingRemoval.value;
  pendingRemoval.value = null;

  if (track !== null) {
    await library.remove(track.id);
  }
}

async function confirmMissingRemoval() {
  const cameFromLibraryImport = hasMissingFromLibraryImport.value;

  isRemovingMissing.value = false;
  unplayableTitle.value = null;
  await library.removeMissingTracks();
  await settings.setDismissedMissingReport('');

  if (cameFromLibraryImport) {
    library.dismissLibraryImport();
  }
}
</script>

<template>
  <!-- Files can be dropped anywhere on the library, so the outline is the view itself: an
       empty library is exactly where the first drop lands. -->
  <div
    class="library_view"
    :class="{ library_view_dropping: isDraggingOver }"
    data-testid="library-view"
  >
    <header class="library_view_header">
      <LibraryTitle />
      <LibraryToolbar
        :view-mode="displayedViewMode"
        :selected-count="library.selectedIds.length"
        :show-sort="showsSortControl"
        :preview-size-page="previewSizePage"
        :sort="activeFacet === null ? undefined : facetSort"
        :sort-options="activeFacet === null ? undefined : facetSortOptions"
        @update:view-mode="setDisplayedViewMode"
        @sort="sortFacets"
        @edit-selected="openBulkEditor"
      />
    </header>

    <p v-if="library.errorKey !== null" class="library_view_error common_surface_alt" role="alert">
      {{ t(`library.errors.${library.errorKey}`) }}
    </p>

    <DefaultPlayerBanner v-if="!settings.defaultPlayerBannerDismissed" />

    <LibraryBanner
      v-if="library.lastExport !== null"
      icon="export"
      data-testid="export-notice"
      @dismiss="library.dismissExport()"
    >
      {{ t('library.catalog.exported', { path: library.lastExport }) }}
    </LibraryBanner>

    <LibraryBanner
      v-if="library.lastLibraryImport !== null && hasMissingFromLibraryImport"
      tone="warning"
      alert
      data-testid="library-import-notice"
      @dismiss="library.dismissLibraryImport()"
    >
      {{
        t('settings.importExport.report.summary', {
          total: library.lastLibraryImport.total,
          added: library.lastLibraryImport.added,
          updated: library.lastLibraryImport.updated,
          skipped: library.lastLibraryImport.skipped,
          missing: library.lastLibraryImport.missing.length,
        })
      }}

      <template #action>
        <AppButton
          variant="danger"
          data-testid="remove-missing-from-library-import"
          @click="isRemovingMissing = true"
        >
          {{ t('library.refresh.removeMissing') }}
        </AppButton>
      </template>
    </LibraryBanner>

    <LibraryBanner
      v-else-if="library.lastLibraryImport !== null"
      icon="import"
      data-testid="library-import-notice"
      @dismiss="library.dismissLibraryImport()"
    >
      {{
        t('settings.importExport.report.summary', {
          total: library.lastLibraryImport.total,
          added: library.lastLibraryImport.added,
          updated: library.lastLibraryImport.updated,
          skipped: library.lastLibraryImport.skipped,
          missing: library.lastLibraryImport.missing.length,
        })
      }}
    </LibraryBanner>

    <!-- The filter outlives the window it was set in, and a shorter list looks like a
         smaller library rather than like a filtered one: the banner says which it is, and
         carries the way out of it. -->
    <LibraryBanner
      v-if="library.missingInfoFilter !== 'all'"
      tone="warning"
      icon="search"
      :dismissible="false"
      data-testid="missing-info-banner"
    >
      {{
        t('library.missingInfo.filtered', {
          filter: t(`library.toolbar.missingInfo.options.${library.missingInfoFilter}`),
        })
      }}

      <template #action>
        <AppButton
          variant="ghost"
          data-testid="missing-info-reset"
          @click="library.setMissingInfoFilter('all')"
        >
          {{ t('library.missingInfo.reset') }}
        </AppButton>
      </template>
    </LibraryBanner>

    <AppModal
      :open="unplayableTitle !== null"
      :title="t('library.playback.missingTitle')"
      @close="dismissUnplayableBanner"
    >
      {{ t('library.playback.unavailable', { title: unplayableTitle }) }}

      <template #actions>
        <AppButton @click="dismissUnplayableBanner">{{ t('library.remove.cancel') }}</AppButton>
        <AppButton
          variant="danger"
          data-testid="remove-missing-from-playback"
          @click="openMissingRemovalFromPlayback"
        >
          {{ t('library.refresh.removeMissing') }}
        </AppButton>
      </template>
    </AppModal>

    <!-- What the refresh found on opening: files gone from disk are a warning, tags read
         again are a note. -->
    <LibraryBanner
      v-if="showsRecoveredBanner"
      icon="verify"
      data-testid="refresh-recovered"
      @dismiss="library.dismissRecovered()"
    >
      {{
        t(
          'library.refresh.recovered',
          { count: library.lastRefreshRecovered },
          library.lastRefreshRecovered,
        )
      }}
    </LibraryBanner>

    <LibraryBanner
      v-if="showsMissingBanner"
      tone="warning"
      alert
      data-testid="refresh-missing"
      @dismiss="dismissMissingReport"
    >
      {{
        t(
          'library.refresh.missing',
          { count: library.lastRefresh?.missing.length ?? 0 },
          library.lastRefresh?.missing.length ?? 0,
        )
      }}

      <template #action>
        <AppButton variant="danger" data-testid="remove-missing" @click="isRemovingMissing = true">
          {{ t('library.refresh.removeMissing') }}
        </AppButton>
      </template>
    </LibraryBanner>

    <LibraryBanner
      v-if="
        !showsMissingBanner && !showsRecoveredBanner && (library.lastRefresh?.refreshed ?? 0) > 0
      "
      icon="verify"
      data-testid="refresh-updated"
      @dismiss="library.dismissRefresh()"
    >
      {{
        t(
          'library.refresh.refreshed',
          { count: library.lastRefresh?.refreshed ?? 0 },
          library.lastRefresh?.refreshed ?? 0,
        )
      }}
    </LibraryBanner>

    <LibraryBanner
      v-if="library.lastVerification !== null && showsVerificationBanner"
      icon="verify"
      :tone="library.lastVerification.missing > 0 ? 'warning' : 'info'"
      data-testid="verification-notice"
      @dismiss="dismissVerificationBanner"
    >
      {{
        t('library.verification.summary', {
          total: library.lastVerification.total,
          missing: library.lastVerification.missing,
        })
      }}

      <template v-if="library.lastVerification.missing > 0" #action>
        <AppButton
          variant="danger"
          data-testid="remove-missing-from-verification"
          @click="isRemovingMissing = true"
        >
          {{ t('library.refresh.removeMissing') }}
        </AppButton>
      </template>
    </LibraryBanner>

    <LibraryImportReport
      v-if="library.lastReport !== null"
      :report="library.lastReport"
      @dismiss="library.dismissReport()"
    />

    <LibraryImportProgress v-if="library.isImporting" />
    <div v-else-if="!library.isReady || library.isLoading" class="library_view_loading">
      <AppSpinner :label="t('library.loading')" />
    </div>
    <template v-else-if="library.isEmpty">
      <LibraryEmptyState variant="empty" />
    </template>
    <template v-else>
      <!-- The tabs name what is on screen, the counts say how much of it there is. -->
      <div class="library_view_tabs">
        <LibraryContentTabs v-model="activeTab" />
        <LibraryCounts :tab="activeTab" />
      </div>

      <section
        :id="`library-panel-${activeTab}`"
        class="library_view_panel"
        role="tabpanel"
        :aria-labelledby="`library-tab-${activeTab}`"
      >
        <LibraryEmptyState
          v-if="library.hasNoMatches"
          :variant="library.missingInfoFilter === 'all' ? 'noMatches' : 'noMissingInfo'"
        />
        <PreviewGrid
          v-else-if="activeTab === 'tracks' && settings.viewMode === 'preview'"
          :tracks="library.visibleTracks"
          :selected-ids="library.selectedIds"
          :playing-id="player.currentTrack?.id ?? null"
          @select="selectFromTracks($event, library.visibleTracks)"
          @play="startPlayback($event)"
          @edit="library.openEditor($event.id)"
          @remove="askRemoval"
        />
        <LibraryTable
          v-else-if="activeTab === 'tracks'"
          :tracks="library.visibleTracks"
          :sort="library.sort"
          :selected-ids="library.selectedIds"
          :playing-id="player.currentTrack?.id ?? null"
          @sort="library.toggleSort($event)"
          @select="selectFromTracks($event, library.visibleTracks)"
          @play="startPlayback($event)"
          @edit="library.openEditor($event.id)"
          @remove="askRemoval"
        />
        <LibraryFacetList
          v-else-if="activeFacet !== null"
          v-model:sort="facetSort"
          :tracks="library.visibleTracks"
          :field="activeFacet"
          :view-mode="activeFacetViewMode"
          :playing-track="player.currentTrack"
          @open="openFacet"
        />
      </section>
    </template>

    <AppModal
      :open="selectedFacet !== null"
      :title="t('library.groups.modalTitle', { name: selectedFacet?.name ?? '' })"
      wide
      glass
      content-scrolls
      @close="closeFacetModal"
    >
      <div class="library_view_group_modal">
        <!-- The way back names the group it returns to: three levels down, an arrow alone
             says nothing about where it lands. -->
        <button
          v-if="previousFacet !== null"
          class="library_view_group_modal_back"
          type="button"
          :aria-label="t('library.groups.backTo', { name: previousFacet.name })"
          data-testid="facet-modal-back"
          @click="goBackInFacetModal"
        >
          <AppIcon name="back" />
          <span class="library_view_group_modal_back_label">
            {{ t('library.groups.backTo', { name: previousFacet.name }) }}
          </span>
        </button>

        <div class="library_view_group_modal_header">
          <LibraryAlbumSummary
            v-if="selectedFacet?.field === 'album'"
            :name="selectedFacet.name"
            :cover-track="selectedAlbumCoverTrack"
            :year="selectedAlbumYear"
            :artists="selectedAlbumArtistLinks"
            :genres="selectedAlbumGenreLinks"
            :track-count="selectedFacetTracks.length"
            @open-artist="openArtistFromCarousel"
            @open-genre="openGenreFromSummary"
          />
          <div v-else class="library_view_group_modal_summary">
            <p>
              {{
                t(
                  'library.groups.trackCount',
                  { count: selectedFacetTracks.length },
                  selectedFacetTracks.length,
                )
              }}
            </p>
          </div>
          <LibraryViewToggle v-if="selectedFacet?.field === 'album'" v-model="groupModalViewMode" />
        </div>

        <template v-if="selectedFacet?.field === 'artist'">
          <LibraryGroupCarousel
            :title="t('library.groups.columns.albums')"
            :groups="albumCarouselGroups"
            data-testid="artist-albums-carousel"
            @open="openAlbumFromCarousel"
          />

          <LibraryTable
            :tracks="selectedFacetTracks"
            :sort="library.sort"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            :column-keys="artistModalColumnKeys"
            :show-column-settings="false"
            @sort="library.toggleSort($event)"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
          />
        </template>

        <template v-else-if="selectedFacet?.field === 'genre'">
          <LibraryTabs
            v-model="genreModalList"
            :tabs="genreModalTabs"
            :label="t('library.groups.detailTabs')"
            id-base="genre-detail"
          />

          <div
            :id="`genre-detail-panel-${genreModalList}`"
            class="library_view_group_modal_panel"
            role="tabpanel"
            :aria-labelledby="`genre-detail-tab-${genreModalList}`"
          >
            <LibraryTable
              v-if="genreModalList === 'tracks'"
              :tracks="selectedFacetTracks"
              :sort="library.sort"
              :selected-ids="library.selectedIds"
              :playing-id="player.currentTrack?.id ?? null"
              :column-keys="genreModalColumnKeys"
              :show-column-settings="false"
              @sort="library.toggleSort($event)"
              @select="selectFromTracks($event, selectedFacetTracks)"
              @play="startFacetPlayback($event)"
              @edit="openEditor"
              @remove="askRemoval"
            />
            <!-- Artists and albums are browsed by their covers, tracks by their columns. -->
            <template v-else>
              <div class="library_view_group_modal_controls">
                <LibrarySortSelect
                  :column="genreModalSort.column"
                  :direction="genreModalSort.direction"
                  :options="genreModalSortOptions"
                  @select="sortGenreModal"
                />
                <PreviewSizeToggle :page="genreModalList" />
              </div>

              <LibraryFacetList
                v-model:sort="genreModalSort"
                :tracks="selectedFacetTracks"
                :field="genreModalField"
                view-mode="preview"
                :playing-track="player.currentTrack"
                @open="openFacet"
              />
            </template>
          </div>
        </template>

        <template v-else>
          <PreviewGrid
            v-if="groupModalViewMode === 'preview'"
            :tracks="selectedFacetTracks"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            :meta-keys="albumModalPreviewMetaKeys"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
          />
          <LibraryTable
            v-else
            :tracks="selectedFacetTracks"
            :sort="library.sort"
            :selected-ids="library.selectedIds"
            :playing-id="player.currentTrack?.id ?? null"
            :column-keys="albumModalColumnKeys"
            :show-column-settings="false"
            @sort="library.toggleSort($event)"
            @select="selectFromTracks($event, selectedFacetTracks)"
            @play="startFacetPlayback($event)"
            @edit="openEditor"
            @remove="askRemoval"
          />
        </template>
      </div>

      <template #actions>
        <AppButton @click="closeFacetModal">{{ t('library.groups.close') }}</AppButton>
      </template>
    </AppModal>

    <MetadataEditor
      v-if="library.editingTrack !== null"
      :track="library.editingTrack"
      @close="library.closeEditor()"
    />

    <BulkMetadataEditor
      v-if="isBulkEditorOpen"
      :tracks="library.selectedTracks"
      @close="isBulkEditorOpen = false"
    />

    <AppModal
      :open="pendingRemoval !== null"
      :title="t('library.remove.title')"
      @close="pendingRemoval = null"
    >
      {{ t('library.remove.message', { title: pendingRemoval?.title ?? '' }) }}
      <template #actions>
        <AppButton @click="pendingRemoval = null">{{ t('library.remove.cancel') }}</AppButton>
        <AppButton variant="danger" data-testid="confirm-remove" @click="confirmRemoval">
          {{ t('library.remove.confirm') }}
        </AppButton>
      </template>
    </AppModal>

    <AppModal
      :open="isRemovingMissing"
      :title="t('library.refresh.removeMissingTitle')"
      @close="isRemovingMissing = false"
    >
      {{
        t('library.refresh.removeMissingMessage', {
          count: library.tracks.filter((track) => track.missing).length,
        })
      }}
      <template #actions>
        <AppButton @click="isRemovingMissing = false">{{ t('library.remove.cancel') }}</AppButton>
        <AppButton
          variant="danger"
          data-testid="confirm-remove-missing"
          @click="confirmMissingRemoval"
        >
          {{ t('library.refresh.removeMissing') }}
        </AppButton>
      </template>
    </AppModal>
  </div>
</template>

<style scoped lang="scss">
.library_view {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: $space_md;
  min-height: 0;
  padding-bottom: $space_md;
  border: 2px dashed transparent;
  border-radius: $radius_lg;
  transition:
    background-color $duration_fast ease,
    border-color $duration_fast ease;

  // Files land anywhere on the library, so the whole view lights up: the panel alone left an
  // empty library, the very case where the first drop happens, without a target.
  &_dropping {
    border-color: var(--color_accent);
    background-color: var(--color_accent_soft);
  }

  &_header {
    display: flex;
    flex-direction: column;
    gap: $space_md;
  }

  &_error {
    display: flex;
    gap: $space_sm;
    align-items: center;
    justify-content: space-between;
    padding: $space_sm $space_md;
    color: var(--color_text);

    border-color: var(--color_border_strong);
  }

  // A little air above the line, so the counts do not touch the toolbar over them.
  // The line under the tabs belongs to the row, not to the strip of tabs: the counts sit on
  // the same line, and a rail that stopped where the tabs stop left it cut short of them.
  &_tabs {
    display: flex;
    flex-wrap: wrap;
    gap: $space_sm $space_md;
    align-items: stretch;
    justify-content: space-between;
    padding-top: $space_xs;
    border-bottom: 1px solid var(--color_border);

    // The strip keeps the indicator that runs along the bottom of it, and gives up the rail
    // it used to draw for itself.
    :deep(.library_tabs::after) {
      display: none;
    }
  }

  &_panel {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-height: 0;
  }

  &_loading {
    display: grid;
    flex: 1;
    min-height: 12rem;
    place-items: center;
  }

  &_group_modal {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: $space_md;
    // It fills the dialog and shrinks with it: the list inside is what scrolls, whatever
    // the pointer is doing — a wheel, a gesture, or the scrollbar itself.
    min-height: 0;

    // The album header is a block of its own height: the back button and the view switch
    // stay on its first line instead of floating in the middle of it.
    &_header {
      display: flex;
      gap: $space_md;
      align-items: flex-start;
      justify-content: space-between;
      color: var(--color_text_muted);
      font-size: 0.875em;
    }

    &_panel {
      display: flex;
      flex: 1;
      flex-direction: column;
      gap: $space_sm;
      min-height: 0;
    }

    // Above the cards they act on, at the end of the row: the same place the page keeps
    // its own, so a window is read the way the page behind it is.
    &_controls {
      display: flex;
      gap: $space_sm;
      align-items: center;
      justify-content: flex-end;
      flex-shrink: 0;
    }

    &_back {
      display: inline-flex;
      gap: $space_xs;
      align-self: flex-start;
      align-items: center;
      max-width: 100%;
      min-height: 2rem;
      padding: $space_2xs $space_sm $space_2xs $space_xs;
      border: 1px solid var(--color_border);
      border-radius: 999px;
      background-color: var(--color_surface_alt);
      color: var(--color_text);
      font: inherit;
      font-size: 0.875em;
      cursor: pointer;
      transition:
        background-color $duration_fast ease,
        border-color $duration_fast ease;

      &:hover {
        border-color: var(--color_accent);
        background-color: var(--row_hover_background);
      }

      @include focus_ring;

      &_label {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }

    &_summary {
      display: flex;
      flex: 1;
      flex-wrap: wrap;
      gap: $space_xs $space_md;
      min-width: 0;

      p {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
  }
}
</style>
