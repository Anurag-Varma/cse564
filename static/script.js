var main_response, selected_path_points=[], mds_pcp_flag=true;

  
function load_data(){
    d3.json("/data").then(function(response) {
        main_response=response;
    })
    .then(function(){
       //renderPCP();
       lineChart();
    })

}
load_data()



function lineChart() {
    var svgWidth = 960, svgHeight = 500;
    var margin = { top: 20, right: 80, bottom: 30, left: 50 };
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;

    var svg = d3.select("#line-plot").append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleTime().range([0, width]);
    var y = d3.scaleLinear().range([height, 0]);

    var color = d3.scaleOrdinal(d3.schemeCategory10);

    var line = d3.line()
        .x(function(d) { return x(d.date); })
        .y(function(d) { return y(d.frequency); });

    var songData = JSON.parse(main_response.song_frequency_over_time);

    songData.forEach(function(d) {
        d.snapshot_date = new Date(d.snapshot_date);
    });

    color.domain(Object.keys(songData[0]).filter(function(key) { return key !== "snapshot_date"; }));

    var songs = color.domain().map(function(name) {
        return {
            name: name,
            values: songData.map(function(d) {
                return {date: d.snapshot_date, frequency: +d[name]};
            })
        };
    });

    x.domain(d3.extent(songData, function(d) { return d.snapshot_date; }));

    y.domain([
        d3.min(songs, function(c) { return d3.min(c.values, function(v) { return v.frequency; }); }),
        d3.max(songs, function(c) { return d3.max(c.values, function(v) { return v.frequency; }); })
    ]);

    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x));

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y));

    var song = svg.selectAll(".song")
        .data(songs)
        .enter().append("g")
        .attr("class", "song");

    song.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return line(d.values); })
        .style("stroke", function(d) { return color(d.name); });

    song.append("text")
        .datum(function(d) { return {name: d.name, value: d.values[d.values.length - 1]}; })
        .attr("transform", function(d) { return "translate(" + x(d.value.date) + "," + y(d.value.frequency) + ")"; })
        .attr("x", 3)
        .attr("dy", "0.35em")
        .style("font", "10px sans-serif")
        .text(function(d) { return d.name; });
}





function renderPCP() {
    var pcpData;

    // Check if MDS-PCP flag is set to true or false
    if (mds_pcp_flag == true) {
        pcpData = JSON.parse(main_response.pcp_data);
    } else {
        pcpData = JSON.parse(main_response.pcp_data);

        // Extract selected data points
        const selectedData = pcpData.map(obj => {
            const selectedObj = { "Cluster": obj.Cluster }; // Adding "Cluster" key by default
            selected_path_points.forEach(({ Variable }) => {
                if (obj.hasOwnProperty(Variable)) {
                    selectedObj[Variable] = obj[Variable];
                }
            });
            return selectedObj;
        });

        pcpData = selectedData;
    }

    // Remove any existing SVG to prevent duplicates
    d3.select("#pcp-plot").select("svg").remove();

    // Define margins, width, and height for the plot area
    const margin = { top: 30, right: 10, bottom: 50, left: 40 }, // Increased left margin for axis labels
        width = 1500 - margin.left - margin.right,
        height = 550 - margin.top - margin.bottom;

    // Append SVG and a group element to the DOM
    const svg = d3.select("#pcp-plot")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add title to the plot
    svg.append("text")
        .attr("class", "plot-title")
        .attr("x", (width + margin.left + margin.right) / 2 - 30)
        .attr("y", margin.bottom + 460)
        .attr("text-anchor", "middle")
        .text("PCP Plot")
        .style("font-weight", "bold");

    // Determine dimensions excluding 'Cluster'
    const dimensions = Object.keys(pcpData[0]).filter(d => d !== "Cluster");

    // X scale mapping dimension names to positions
    const x = d3.scalePoint()
        .range([0, width])
        .padding(1)
        .domain(dimensions);

    // Y scales for each dimension
    const y = {};
    dimensions.forEach(d => {
        y[d] = d3.scaleLinear()
            .domain(d3.extent(pcpData, p => +p[d]))
            .range([height, 0]);
    });

    // Color scale for different clusters
    const color = d3.scaleOrdinal(d3.schemeCategory10);

    // Define and append paths for the PCP lines
    const pathsGroup = svg.append("g");

    // Function to update paths
    function updatePaths(data) {
        const paths = pathsGroup.selectAll("path")
            .data(data);

        paths.enter().append("path")
            .merge(paths) // Merge enter and update selection
            .attr("d", drawPath)
            .style("stroke", d => color(d.Cluster))
            .style("opacity", 0.7);

        paths.exit().remove(); // Remove any unnecessary paths
    }

    updatePaths(pcpData); // Initial path rendering

    // Define D3 axis generator
    const axis = d3.axisLeft();

    // Append axis elements for each dimension
    const dimension = svg.selectAll(".dimension")
        .data(dimensions)
        .enter().append("g")
        .attr("class", "dimension")
        .attr("transform", d => `translate(${x(d)})`)
        .call(d3.drag() // Add drag functionality to move dimensions
            .on("start", dragStarted)
            .on("drag", dragged)
            .on("end", dragEnded));

    // Function to handle drag start event
    function dragStarted(event) {
        type=event.sourceEvent.srcElement.tagName

        if (type=="text" || type=="DIV") {
            event.sourceEvent.stopPropagation();
            this.__origin__ = { x: event.x };
            this.__crossed = false; // Initialize crossed flag
        }
    }

    // Function to handle dragging event
    function dragged(event, d) {

        type=event.sourceEvent.srcElement.tagName

        if (type=="text" || type=="DIV") {

            const dx = event.x - this.__origin__.x; // Calculate the change in x
            const currentX = x(d) + dx;

            // Update axis position
            d3.select(this).attr("transform", `translate(${currentX})`);

            // Check for axis crossing and swap if necessary
            const currentIndex = dimensions.indexOf(d);
            const nextIndex = findNextAxisIndex(currentIndex, currentX);
            if (nextIndex !== -1 && nextIndex !== currentIndex) {
                // Swap axes
                const nextDimension = dimensions[nextIndex];
                dimensions[currentIndex] = nextDimension;
                dimensions[nextIndex] = d;
                x.domain(dimensions);
                svg.selectAll(".dimension")
                    .attr("transform", dimension => `translate(${x(dimension)})`);

                this.__origin__.x = event.x; // Reset origin to current position
                this.__crossed = true; // Set crossed flag
            }

            // If crossed, restart the dragging process
            if (this.__crossed) {
                this.__origin__.x = event.x;
                this.__crossed = false;
            }

            // Update path lines
            svg.selectAll("path").attr("d", function (pathData) {
                return drawPath(pathData, d, currentX);
            });
        }

    }

    // Function to handle drag end event
    function dragEnded(event) {
        event.sourceEvent.stopPropagation();
    }

    // Draw axes and labels
    dimension.append("g")
        .attr("class", "axis")
        .each(function (d) { d3.select(this).call(axis.scale(y[d])); })
        .append("text")
        .style("text-anchor", "middle")
        .attr("y", -9)
        .text(d => d)
        .style("cursor", "crosshair")
        .style("font-size", "15px"); // Increase the font size here

    // Add brush functionality to filter dimensions
    dimension.append("g")
        .attr("class", "brush")
        .each(function(d) {
            d3.select(this).call(d3.brushY()
                .extent([[-8, 0], [8, height]])
                .on("start", brushstart)
                .on("brush", brush)
                .on("end", brushend));
    });

    // Function to handle brush start event
    function brushstart() {
        d3.event.sourceEvent.stopPropagation();
    }

    // Function to handle brush event
    function brush() {
        const actives = [];
        svg.selectAll(".brush")
            .filter(function(d) {
                return d3.brushSelection(this);
            })
            .each(function(d) {
                actives.push({
                    dimension: d,
                    extent: d3.brushSelection(this).map(y[d].invert)
                });
            });

        svg.selectAll("path").style("display", function(d) {
            return actives.every(function(active) {
                const dim = active.dimension;
                const extent = active.extent;
                return extent[1] <= d[dim] && d[dim] <= extent[0];
            }) ? null : "none";
        });
    }

    // Function to handle brush end event
    function brushend() {
        d3.event.sourceEvent.stopPropagation();
    }

    // Function to draw path lines
    function drawPath(d, draggedDimension, currentX) {
        return d3.line()(dimensions.map(p => {
            if (p === draggedDimension) {
                // If this is the dragged dimension, adjust its x position
                return [currentX, y[p](d[p])];
            } else {
                return [x(p), y[p](d[p])];
            }
        }));
    }

    // Function to find the next axis index
    function findNextAxisIndex(currentIndex, currentX) {
        let nextIndex = -1;
        if (currentIndex > 0 && currentX < x(dimensions[currentIndex - 1])) {
            nextIndex = currentIndex - 1;
        } else if (currentIndex < dimensions.length - 1 && currentX > x(dimensions[currentIndex + 1])) {
            nextIndex = currentIndex + 1;
        }
        return nextIndex;
    }
}
