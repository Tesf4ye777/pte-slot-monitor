interface CenterFixture {
  componentId: number;
  centerId: string;
  name: string;
  address: string;
  distance: number;
  date: string;
  times: string[];
}

export function pearsonPage(centers: CenterFixture[]): string {
  return `<!doctype html><html><body>
    <button id="TagAlongLink"><span id="tagAlongAriaId">PTE-A: PTE Academic</span></button>
    <input id="testCentersNearAddress" value="Sydney NSW Australia" />
    <div id="searchResultsLabelHeader">Search Results</div>
    <div>Search has returned available test centres</div>
    <section id="test-center-info-section">
      ${centers.map(centerCard).join("\n")}
    </section>
  </body></html>`;
}

export function center(overrides: Partial<CenterFixture> = {}): CenterFixture {
  return {
    componentId: 1,
    centerId: "50482",
    name: "Pearson Professional Centers-Sydney, Australia",
    address: "Level 2, 10 Bridge Street Sydney, New South Wales 2000 Australia",
    distance: 0.1,
    date: "18 October 2026",
    times: ["6:00 PM", "8:30 PM"],
    ...overrides
  };
}

function centerCard(item: CenterFixture): string {
  return `<article id="result_card_${item.componentId}">
    <div id="tc_distance_${item.centerId}">${item.distance} mi</div>
    <div id="test-center-info-link_${item.componentId}">${item.name}</div>
    <div id="tc_address_${item.centerId}">${item.address}</div>
    <div id="calender_container_${item.componentId}">
      <input id="preferredDateShown_${item.componentId}" value="${item.date}" />
    </div>
    <select id="appt_menu_${item.componentId}">
      ${item.times.map((time) => `<option>${time}</option>`).join("")}
    </select>
    <input id="btn_${item.componentId}" type="button" value="Book" />
  </article>`;
}
