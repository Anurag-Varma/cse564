var main_response, selected_path_points=[], mds_pcp_flag=true;

  
function load_data(){
    d3.json("/data").then(function(response) {
        main_response=response;
    })
    .then(function(){
       lineChart();
    })
    .then(function(){
        timeSeriesPlot();
     })
     .then(function(){
        drawWorldMap();
     })
     .then(function(){
        renderPCP();
     })


     

}
load_data()



function lineChart() {
    var svgWidth = 750, svgHeight = 270;
    var margin = { top: 30, right: 140, bottom: 20, left: 60 };
    var width = svgWidth - margin.left - margin.right;
    var height = svgHeight - margin.top - margin.bottom;

    d3.select("#line-plot").select("svg").remove();

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
        .call(d3.axisBottom(x).ticks(d3.timeWeek.every(1)).tickFormat(d3.timeFormat("%m-%d")))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "1em")
        .attr("dy", ".85em")
        .attr("transform", "rotate(0)");

    svg.append("g")
        .attr("class", "y axis")
        .call(d3.axisLeft(y));

        var song = svg.selectAll(".song")
        .data(songs)
        .enter().append("g")
        .attr("class", "song");

    var path = song.append("path")
        .attr("class", "line")
        .attr("d", function(d) { return line(d.values); })
        .style("stroke", function(d) { return color(d.name); });

    var highlightElements = function() {
        var selected = this;
        d3.selectAll(".line").filter(function() {
            return this !== selected;
        }).classed("faded", true);
        d3.select(this).classed("highlight", true).classed("faded", false);
    };

    var resetElements = function() {
        d3.selectAll(".line").classed("faded", false).classed("highlight", false);
    };

    path.on("mouseover", highlightElements)
        .on("mouseout", resetElements);

    // Create a legend at the specified position
    var legend = svg.append("g")
        .attr("class", "legend")
        .attr("transform", "translate(" + (width + 5) + ",10)");

    legend.selectAll(".legend-entry")
        .data(songs)
        .enter().append("g")
        .attr("class", "legend-entry")
        .attr("transform", function(d, i) { return "translate(0," + i * 20 + ")"; })
        .each(function(d) {
            d3.select(this).append("rect")
                .attr("width", 10)
                .attr("height", 10)
                .attr("fill", color(d.name));

            d3.select(this).append("text")
                .attr("x", 15)
                .attr("y", 10)
                .text(d.name)
                .style("font", "10px sans-serif")
                .attr("text-anchor", "start");
        });
}



function timeSeriesPlot() {
    // Existing code to parse data and set up the graph
    var songData = JSON.parse(main_response.song_frequency_over_time);
    var parseDate = d3.timeParse("%Y-%m-%d");

    var fixedStartDate = new Date(main_response.fixed_start_date)
    var fixedEndDate = new Date(main_response.fixed_end_date)
    
    songData.forEach(function(d) {
        d.snapshot_date = parseDate(d.snapshot_date);
    });

    var margin = { top: 5, right: 20, bottom: 30, left: 60 },
        width = 630 - margin.left - margin.right,
        height = 60 - margin.top - margin.bottom;

    var svg = d3.select("#date-selector").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    var x = d3.scaleTime()
        .range([0, width])
        .domain([fixedStartDate, fixedEndDate]);

    var xAxis = d3.axisBottom(x)
        .ticks(d3.timeWeek.every(1))
        .tickFormat(d3.timeFormat("%m-%d"));

    svg.append("g")
        .attr("class", "x-axis")
        .attr("transform", "translate(0," + height + ")")
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "1em")
        .attr("dy", "1em");

    // Brush setup
    var brush = d3.brushX()
        .extent([[0, 0], [width, height]])
        .on("end", updateDateRange);

    svg.append("g")
        .attr("class", "brush")
        .call(brush)
        .call(brush.move, x.range()); // Set initial brush selection to the full range

    function updateDateRange(event) {
        const selection = event.selection;
        if (!selection) return; // Ignore empty selections
    
        var startDate = x.invert(selection[0]);
        var endDate = x.invert(selection[1]);
        const oneDay = 86400000; // milliseconds in one day
        const minDuration = 7 * oneDay; // minimum duration of 7 days
        
        // Check if the dates are valid
        if (!(startDate instanceof Date && !isNaN(startDate)) || !(endDate instanceof Date && !isNaN(endDate))) {
            console.error("Invalid date(s) detected:", startDate, endDate);
            return; // Stop the function if dates are invalid
        }
    
        // Check if the duration is less than 7 days
        if (endDate - startDate < minDuration) {
            endDate = new Date(startDate.getTime() + minDuration); // Set end date to start date + 7 days
            d3.select(".brush").call(brush.move, [x(startDate), x(endDate)]);
        }
    
        sendDateRangeToFlask(startDate, endDate);
    }
    


    // Function to send data to Flask
    function sendDateRangeToFlask(startDate, endDate) {
        fetch('/update-date-range', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                start_date: startDate.toISOString().slice(0, 10),
                end_date: endDate.toISOString().slice(0, 10)
            })
        }).then(response => response.json())
          .then(
            d3.json("/data").then(function(response) {
                main_response=response;
            })
            .then(function(){
               lineChart();
            })
            .then(function(){
                drawWorldMap();
             })
            .then(function(){
                renderPCP();
             })
        )
          .catch((error) => console.error('Error:', error));
    }
}




function drawWorldMap() {
    // Assuming main_response.country_frequency_dict is already parsed and accessible
    const countryFrequencyData = main_response.country_frequency_dict;


    // Load and display the World Atlas TopoJSON
    d3.json("https://d3js.org/world-110m.v1.json").then(function(world) {
        const countries = topojson.feature(world, world.objects.countries).features;
        const frequencies = countries.map(d => countryFrequencyData[d.id]?.frequency || 0);
        const colorScale = d3.scaleSequential(d3.interpolateViridis)
                             .domain([d3.min(frequencies), d3.max(frequencies)]);

        d3.select("#world-map").select("svg").remove();
        const svg = d3.select("#world-map").append("svg")
                      .attr("width", 750)
                      .attr("height", 350);

        const projection = d3.geoMercator()
                             .scale(85)
                             .translate([350, 250]);

        const path = d3.geoPath().projection(projection);

        const tooltip = d3.select("body").append("div")
                          .attr("class", "tooltip")
                          .style("position", "absolute")
                          .style("visibility", "hidden")
                          .style("background", "lightgrey")
                          .style("border", "solid 1px black")
                          .style("border-radius", "5px")
                          .style("padding", "5px");

        svg.selectAll("path")
           .data(countries)
           .enter().append("path")
           .attr("d", path)
           .attr("fill", d => {
               const frequency = countryFrequencyData[d.id]?.frequency;
               return frequency ? colorScale(frequency) : "#ccc";
           })
           .attr("stroke", "white")
           .on("mouseover", function(event, d) {
               const countryInfo = countryFrequencyData[d.id];

               if (countryInfo) {
                   tooltip.style("visibility", "visible")
                          .html(`${countryInfo.country_name}: ${countryInfo.frequency}`)
                          .style("top", `${event.pageY - 10}px`)
                          .style("left", `${event.pageX + 10}px`);
               }
           })
           .on("mouseout", function() {
               tooltip.style("visibility", "hidden");
           });

        // Consider adding a legend here to explain the color scale
    }).catch(function(error) {
        console.error('Error loading or processing data:', error);
    });
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
    const margin = { top: 30, right: 10, bottom: 5, left: 5 }, // Increased left margin for axis labels
        width = 780 - margin.left - margin.right,
        height = 300 - margin.top - margin.bottom;

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
            .style("opacity", 0.5);

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
        .style("font-size", "10px"); // Increase the font size here

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
