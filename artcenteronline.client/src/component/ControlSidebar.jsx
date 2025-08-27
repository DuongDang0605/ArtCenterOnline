export default function ControlSidebar() {
    return (
        <aside className="control-sidebar control-sidebar-dark">
            <ul className="nav nav-tabs nav-justified control-sidebar-tabs">
                <li><a href="#control-sidebar-home-tab" data-toggle="tab"><i className="fa fa-home" /></a></li>
                <li><a href="#control-sidebar-settings-tab" data-toggle="tab"><i className="fa fa-gears" /></a></li>
            </ul>
            <div className="tab-content">
                <div className="tab-pane" id="control-sidebar-home-tab">
                    <h3 className="control-sidebar-heading">Recent Activity</h3>
                    <p>Empty</p>
                </div>
                <div className="tab-pane" id="control-sidebar-settings-tab">
                    <h3 className="control-sidebar-heading">Settings</h3>
                </div>
            </div>
        </aside>
    );
}
